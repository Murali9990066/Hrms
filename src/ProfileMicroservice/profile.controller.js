const profileModel = require('./profile.model');

const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client,GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const { stat } = require('fs');


const s3 = new S3Client({
    region: process.env.AWS_REGION
});


// Fields employee can update by self
const SELF_EDITABLE_FIELDS = [
    'full_name',
    'mobile_number',
    'address',
    'dob',
    'gender',
    'blood_group',
    'emergency_contact'
];

// Fields only HR / ADMIN can update
const RESTRICTED_FIELDS = [
    'role',
    'is_active',
    'designation',
    'project_assigned',
    'employee_code',
    'joining_date',
    'manager_name'
];
const ALLOWED_DOCUMENTS = [
    'PROFILE_PHOTO',
    'RESUME',
    'DEGREE_CERTIFICATE',
    'EXPERIENCE_LETTER',
    'ADDRESS_PROOF',
    'CANCELLED_CHEQUE'
];

/**
 * GET /profile
 */
exports.getProfile = async (req, res) => {
    try {
        const { role, employeeId } = req.user;

        let targetEmployeeId;

        if (role === 'EMPLOYEE') {
            targetEmployeeId = employeeId;
        } else {
            targetEmployeeId = req.query.employeeId || userId;
        }

        const employee = await profileModel.getEmployeeById(targetEmployeeId);

        if (!employee) {
            return res.status(404).json({ 
                status: "error",
                statusCode: 404,
                message: 'Employee not found' });
        }

        return res.status(200).json({
            status: "success",
            statusCode: 200,
            message: 'Profile fetched successfully',
            data:{
                employee
            }
            });

    } catch (error) {
        console.error('getProfile error:', error);
        return res.status(500).json({ 
            status: "error",
            statusCode: 500,
            message: 'Internal server error' });
    }
};

/**
 * PUT /profile
 */
exports.updateProfile = async (req, res) => {
    try {
        const { role, employeeId } = req.user;
        const body = req.body;

        // Determine target employee
        const targetEmployeeId =
            role === 'EMPLOYEE'
                ? employeeId
                : req.query.employeeId || employeeId;

        // 🔐 EMPLOYEE: can update only self-editable fields
        if (role === 'EMPLOYEE') {
            const forbidden = Object.keys(body).filter(
                key => !SELF_EDITABLE_FIELDS.includes(key)
            );

            if (forbidden.length > 0) {
                return res.status(403).json({
                    status: 'error',
                    statusCode: 403,
                    message: `You cannot update fields: ${forbidden.join(', ')}`
                });
            }
        }

        // 🔐 HR / ADMIN: block self-privilege escalation
        if (
            (role === 'HR' || role === 'ADMIN') &&
            targetEmployeeId === employeeId
        ) {
            if ('role' in body || 'is_active' in body) {
                return res.status(403).json({
                    status: 'error',
                    statusCode: 403,
                    message: 'You cannot modify your own role or active status'
                });
            }
        }

        // 🧹 Filter allowed fields
        const updateData = {};

        Object.keys(body).forEach(key => {
            if (
                SELF_EDITABLE_FIELDS.includes(key) ||
                (RESTRICTED_FIELDS.includes(key) && role !== 'EMPLOYEE')
            ) {
                updateData[key] = body[key];
            }
        });

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'No valid fields provided for update'
            });
        }

        await profileModel.updateEmployee(targetEmployeeId, updateData);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Profile updated successfully',
            data: {}
        });

    } catch (error) {
        console.error('updateProfile error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};


exports.updateRestrictedProfile = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const updates = req.body;
        const requesterRole = req.user.role;

        // 1️⃣ Reject empty body
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'No fields provided for update'
            });
        }

        // 2️⃣ Allow ONLY restricted fields
        const invalidFields = Object.keys(updates).filter(
            field => !RESTRICTED_FIELDS.includes(field)
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: `Invalid fields in request: ${invalidFields.join(', ')}`
            });
        }

        // 3️⃣ Prevent non-admins assigning ADMIN role
        if (updates.role === 'ADMIN' && requesterRole !== 'ADMIN') {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'Only ADMIN can assign ADMIN role'
            });
        }

        // 4️⃣ Check employee exists
        const employee = await profileModel.getEmployeeById(employeeId);
        if (!employee) {
            return res.status(404).json({
                status: 'error',
                statusCode: 404,
                message: 'Employee not found'
            });
        }

        // 5️⃣ Update
        await profileModel.updateEmployee(employeeId, updates);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Restricted profile fields updated successfully',
            data: {}
        });

    } catch (err) {
        console.error('Restricted profile update error:', err);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};

const upload = multer({
    storage: multerS3({
        s3,
        bucket: process.env.S3_BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,

        key: (req, file, cb) => {
            const employeeId = req.user.employeeId;
            const ext = path.extname(file.originalname);

            cb(null, `TEMP/${employeeId}_${Date.now()}${ext}`);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


exports.uploadDocument = async (req, res) => {
    try {
        const employeeId = req.user.employeeId;
        const document_type = req.body?.document_type;

        if (!document_type) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'document_type is required'
            });
        }

        if (!ALLOWED_DOCUMENTS.includes(document_type)) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'Invalid document type'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'File is required'
            });
        }

        await profileModel.insertDocument({
            employee_id: employeeId,
            document_type,
            file_key: req.file.key,
            original_file_name: req.file.originalname
        });

        return res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Document uploaded successfully',
            data: {
                file_key: req.file.key
            }
        });

    } catch (error) {
        console.error('uploadDocument error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: error.message || 'Upload failed'
        });
    }
};



exports.getDocuments = async (req, res) => {
    try {
        const { role, employeeId } = req.user;

        let targetEmployeeId;

        // EMPLOYEE → can see only own documents
        if (role === 'EMPLOYEE') {
            targetEmployeeId = employeeId;
        } else {
            // HR / ADMIN / MANAGER
            targetEmployeeId = req.query.employeeId || employeeId;
        }

        const documents = await profileModel.getEmployeeDocuments(targetEmployeeId);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Documents fetched successfully',
            data: documents
        });

    } catch (error) {
        console.error('getDocuments error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};

exports.accessDocument = async (req, res) => {
    try {
        const { role, employeeId } = req.user;
        const { document_type, employeeId: queryEmployeeId } = req.query;

        if (!document_type) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'document_type is required'
            });
        }

        // EMPLOYEE → only own documents
        const targetEmployeeId =
            role === 'EMPLOYEE'
                ? employeeId
                : queryEmployeeId || employeeId;

        // Fetch document metadata
        const document = await profileModel.getEmployeeDocumentByType(
            targetEmployeeId,
            document_type
        );

        if (!document) {
            return res.status(404).json({
                status: 'error',
                statusCode: 404,
                message: 'Document not found'
            });
        }

        /* ================= VIEW URL ================= */

        const viewCommand = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: document.file_key
        });

        /* ================= DOWNLOAD URL ================= */

        const downloadCommand = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: document.file_key,
            ResponseContentDisposition: `attachment; filename="${document.original_file_name}"`
        });

        const viewUrl = await getSignedUrl(s3, viewCommand, { expiresIn: 300 });
        const downloadUrl = await getSignedUrl(s3, downloadCommand, { expiresIn: 300 });

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Document access URLs generated successfully',
            data: {
                view_url: viewUrl,
                download_url: downloadUrl
            }
        });

    } catch (error) {
        console.error('accessDocument error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Failed to generate document links'
        });
    }
};

exports.upload = upload;
