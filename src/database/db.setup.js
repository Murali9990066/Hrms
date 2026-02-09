/**
 * DB SETUP SCRIPT
 * ----------------
 * Creates required tables for HRMS POC
 *
 * Tables:
 *  - employees   (auth + profile + role)
 *  - otp_logs    (email OTP login)
 *  - documents   (profile documents stored in S3)
 *
 * Safe to run multiple times (idempotent)
 */

require('dotenv').config({
  path: process.env.ENV_FILE || '.env'
});

const pool = require('./db.connection');

/* ============================================================
   EMPLOYEES TABLE
   - Auth + Profile + Role (Single source of truth)
============================================================ */

const createEmployeesTable = `
CREATE TABLE IF NOT EXISTS employees (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Auth / Identity
  email VARCHAR(255) NOT NULL UNIQUE,

  role ENUM('EMPLOYEE','MANAGER','HR','ADMIN')
       NOT NULL DEFAULT 'EMPLOYEE',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Profile core
  full_name VARCHAR(150) NULL,
  mobile_number VARCHAR(20) NULL,
  address TEXT NULL,

  dob DATE NULL,
  gender VARCHAR(20) NULL,
  blood_group VARCHAR(10) NULL,
  emergency_contact VARCHAR(20) NULL,

  -- Org details
  designation VARCHAR(100) NULL,
  project_assigned VARCHAR(150) NULL,

  employee_code VARCHAR(50) UNIQUE NULL,
  joining_date DATE NULL,

  manager_name VARCHAR(150) NULL,

  -- System flags
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP
);
`;

/* ============================================================
   OTP LOGS TABLE
   - Email OTP based authentication
============================================================ */

const createOtpLogsTable = `
CREATE TABLE IF NOT EXISTS otp_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,

  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME NULL,

  INDEX idx_otp_email (email)
);
`;

/* ============================================================
   DOCUMENTS TABLE
   - Profile documents (stored in S3, metadata in DB)
============================================================ */

const createDocumentsTable = `
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  employee_id BIGINT NOT NULL,

  document_type ENUM(
    'PROFESSIONAL_DOCUMENTS',
    'DEGREE',
    'AADHAAR',
    'TAX_DEDUCTIONS_SUPPORTING_DOCUMENTS',
    'EMPLOYMENT_CONTRACT',
    'PREVIOUS_EMPLOYMENT_DOCUMENTS',
    'BANK_ACCOUNT_DETAILS',
    'EMPLOYEE_PHOTO',
    'PAN',
    'CV',
    'OTHER'
  ) NOT NULL,

  file_key VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NULL,

  status ENUM('PENDING','APPROVED','REJECTED')
         NOT NULL DEFAULT 'PENDING',

  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  approved_by BIGINT NULL,
  approved_at DATETIME NULL,

  INDEX idx_employee_docs (employee_id),
  INDEX idx_document_type (document_type),

  CONSTRAINT fk_document_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE CASCADE
);
`;

/* ============================================================
   PROJECTS TABLE
   - Master project data
   - Managed by HR/Admin/Managers
============================================================ */

const createProjectsTable = `
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  name VARCHAR(150) NOT NULL,

  type ENUM('INTERNAL','CLIENT') NOT NULL,
  client_name VARCHAR(150) NULL,

  project_manager BIGINT NOT NULL,

  start_date DATE NOT NULL,
  end_date DATE NULL,

  status ENUM('ACTIVE','PAUSED','CLOSED')
         DEFAULT 'ACTIVE',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_project_manager (project_manager),

  CONSTRAINT fk_project_manager
    FOREIGN KEY (project_manager)
    REFERENCES employees(id)
    ON DELETE RESTRICT
);
`;

/* ============================================================
   PROJECT ASSIGNMENTS TABLE
   - Tracks which employee worked on which project
   - Maintains historical assignment data
============================================================ */

const createProjectAssignmentsTable = `
CREATE TABLE IF NOT EXISTS project_assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  project_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,

  assigned_from DATE NOT NULL,
  assigned_to DATE NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_project_id (project_id),
  INDEX idx_employee_id (employee_id),

  CONSTRAINT fk_assignment_project
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_assignment_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE CASCADE
);
`;

/* ============================================================
   EXECUTION
============================================================ */

(async () => {
  try {
    console.log('🔧 Starting database setup...');

    await pool.query(createEmployeesTable);
    console.log('✅ employees table ready');

    await pool.query(createOtpLogsTable);
    console.log('✅ otp_logs table ready');

    await pool.query(createProjectsTable);
    console.log('✅ projects table ready');

    await pool.query(createProjectAssignmentsTable);
    console.log('✅ project_assignments table ready');

    await pool.query(createDocumentsTable);
    console.log('✅ documents table ready');

    console.log('🎉 Database setup completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
})();
