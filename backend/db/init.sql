-- Database initialization script
-- This runs on PostgreSQL container startup

-- Create database (if using separate script, otherwise docker-compose creates it)
-- CREATE DATABASE app_db;

-- Connect to the database
\c app_db;

-- Table 1: User information
CREATE TABLE IF NOT EXISTS user_information (
    email VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255) NOT NULL
);

-- Table 2: Focus information
CREATE TABLE IF NOT EXISTS focus_information (
    email VARCHAR(255) NOT NULL,
    time TIMESTAMP NOT NULL,
    focus_time_seconds INTEGER NOT NULL,
    category VARCHAR(255) NOT NULL,
    PRIMARY KEY (email, time),
    FOREIGN KEY (email) REFERENCES user_information(email) ON DELETE CASCADE
);

-- Table 3: Focus goal information
CREATE TABLE IF NOT EXISTS focus_goal_information (
    email VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    goal_time_per_week_seconds INTEGER NOT NULL,
    PRIMARY KEY (email, category),
    FOREIGN KEY (email) REFERENCES user_information(email) ON DELETE CASCADE
);

-- Table 4: Category information
CREATE TABLE IF NOT EXISTS category_information (
    email VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    PRIMARY KEY (email, category),
    FOREIGN KEY (email) REFERENCES user_information(email) ON DELETE CASCADE
);

-- Table 5: Verification codes for passwordless login
CREATE TABLE IF NOT EXISTS verification_codes (
    email VARCHAR(255) PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Table 6: Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
);

-- Table 7: Pending registrations awaiting email verification
CREATE TABLE IF NOT EXISTS pending_registrations (
    email VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_focus_information_email ON focus_information(email);
CREATE INDEX IF NOT EXISTS idx_focus_information_time ON focus_information(time);
CREATE INDEX IF NOT EXISTS idx_focus_information_category ON focus_information(category);
CREATE INDEX IF NOT EXISTS idx_focus_goal_information_email ON focus_goal_information(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires_at ON pending_registrations(expires_at);

-- Sample data removed for production database

-- Grant privileges (if needed)
-- GRANT ALL PRIVILEGES ON DATABASE app_db TO postgres;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
