/**
 * DB SETUP SCRIPT
 * ----------------
 * This script creates the required database tables for the POC.
 *
 * Tables:
 *  - employees      (auth + profile + role)
 *  - otp_logs       (OTP-based login)
 *
 * Safe to run multiple times (idempotent).
 */

require('dotenv').config({
  path: process.env.ENV_FILE || '.env'
});
const pool = require('./db.connection');

/* ============================================================
   EMPLOYEES TABLE
   - Single source of truth for users
   - Auth + Profile + Role
============================================================ */

const createEmployeesTable = `
CREATE TABLE IF NOT EXISTS employees (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  email VARCHAR(255) NOT NULL UNIQUE,

  role ENUM('EMPLOYEE','MANAGER','HR','ADMIN')
       NOT NULL DEFAULT 'EMPLOYEE',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  first_login BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,

  -- Profile fields (self-editable / HR-editable)
  employee_code VARCHAR(50) UNIQUE NULL,
  full_name VARCHAR(150) NULL,
  mobile_number VARCHAR(20) NULL,
  joining_date DATE NULL,

  manager_id BIGINT NULL,

  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_manager
    FOREIGN KEY (manager_id) REFERENCES employees(id)
    ON DELETE SET NULL
);
`;

/* ============================================================
   OTP LOGS TABLE
   - Stores OTP lifecycle
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
   EXECUTION
============================================================ */

(async () => {
  try {
    console.log('🔧 Starting database setup...');

    await pool.query(createEmployeesTable);
    console.log('✅ employees table ready');

    await pool.query(createOtpLogsTable);
    console.log('✅ otp_logs table ready');

    console.log('🎉 Database setup completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
})();
