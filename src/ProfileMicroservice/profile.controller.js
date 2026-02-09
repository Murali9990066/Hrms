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
    { id: 1, label: "Professional Documents", isMandatory: false, type: "PROFESSIONAL_DOCUMENTS" },
    { id: 2, label: "Degree", isMandatory: true, type: "DEGREE" },
    { id: 3, label: "Aadhaar", isMandatory: true, type: "AADHAAR" },
    { id: 4, label: "Tax Deductions Supporting Documents", isMandatory: false, type: "TAX_DEDUCTIONS_SUPPORTING_DOCUMENTS" },
    { id: 5, label: "Employment Contract", isMandatory: false, type: "EMPLOYMENT_CONTRACT" },
    { id: 6, label: "Previous Employment Documents", isMandatory: true, type: "PREVIOUS_EMPLOYMENT_DOCUMENTS" },
    { id: 7, label: "Bank Account Details", isMandatory: true, type: "BANK_ACCOUNT_DETAILS" },
    { id: 8, label: "Employee Photo", isMandatory: false, type: "EMPLOYEE_PHOTO" },
    { id: 9, label: "PAN", isMandatory: false, type: "PAN" },
    { id: 10, label: "CV", isMandatory: true, type: "CV" },
    { id: 11, label: "Other", isMandatory: false, type: "OTHER" }
];

/**
 * GET /profile
 */
exports.getProfile = async (req, res) => {
    try {
        const { role, employeeId } = req.user;

        let targetEmployeeId;

        if (role === 'EMPLOYEE' || role === 'MANAGER' || role === 'HR' || role === 'ADMIN') {
            targetEmployeeId = employeeId;
        } else {
            targetEmployeeId = req.query.employeeId;
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

exports.updateProfile = async (req, res) => {
    try {
        const { role, employeeId } = req.user;
        const body = req.body;

        // Target employee
        const targetEmployeeId =
            role === 'EMPLOYEE'
                ? employeeId
                : req.query.employeeId || employeeId;

        // 1️⃣ Reject empty body
        if (!body || Object.keys(body).length === 0) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'No fields provided for update'
            });
        }

        // 2️⃣ Field validation based on role
        let allowedFields = [];

        if (role === 'EMPLOYEE') {
            allowedFields = SELF_EDITABLE_FIELDS;
        } else {
            allowedFields = [
                ...SELF_EDITABLE_FIELDS,
                ...RESTRICTED_FIELDS
            ];
        }

        const invalidFields = Object.keys(body).filter(
            key => !allowedFields.includes(key)
        );

        if (invalidFields.length > 0) {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: `You cannot update fields: ${invalidFields.join(', ')}`
            });
        }

        // 3️⃣ Prevent HR/MANAGER assigning ADMIN role
        if (body.role === 'ADMIN' && role !== 'ADMIN') {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'Only ADMIN can assign ADMIN role'
            });
        }

        // 4️⃣ Prevent self privilege escalation (optional but good)
        if (
            targetEmployeeId === employeeId &&
            role !== 'ADMIN' &&
            ('role' in body || 'is_active' in body)
        ) {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'You cannot modify your own role or active status'
            });
        }

        // 5️⃣ Update
        await profileModel.updateEmployee(targetEmployeeId, body);

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

        // UPDATED VALIDATION
        const isValidDoc = ALLOWED_DOCUMENTS.find(
            doc => doc.type === document_type
        );

        if (!isValidDoc) {
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
