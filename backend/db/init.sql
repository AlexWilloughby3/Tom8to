-- Database initialization script
-- This runs on PostgreSQL container startup

-- Create database (if using separate script, otherwise docker-compose creates it)
-- CREATE DATABASE app_db;

-- Connect to the database
\c app_db;

-- Table 1: User information
CREATE TABLE IF NOT EXISTS user_information (
    userid VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255) NOT NULL
);

-- Table 2: Focus information
CREATE TABLE IF NOT EXISTS focus_information (
    userid VARCHAR(255) NOT NULL,
    time TIMESTAMP NOT NULL,
    focus_time_seconds INTEGER NOT NULL,
    category VARCHAR(255) NOT NULL,
    PRIMARY KEY (userid, time),
    FOREIGN KEY (userid) REFERENCES user_information(userid) ON DELETE CASCADE
);

-- Table 3: Focus goal information
CREATE TABLE IF NOT EXISTS focus_goal_information (
    userid VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    goal_time_per_week_seconds INTEGER NOT NULL,
    PRIMARY KEY (userid, category),
    FOREIGN KEY (userid) REFERENCES user_information(userid) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_focus_information_userid ON focus_information(userid);
CREATE INDEX IF NOT EXISTS idx_focus_information_time ON focus_information(time);
CREATE INDEX IF NOT EXISTS idx_focus_information_category ON focus_information(category);
CREATE INDEX IF NOT EXISTS idx_focus_goal_information_userid ON focus_goal_information(userid);

-- Insert some sample data for testing (optional - remove in production)
INSERT INTO user_information (userid, password) VALUES
    ('user1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYdNq7Z8dFa'),  -- hashed password for 'password123'
    ('user2', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYdNq7Z8dFa')
ON CONFLICT (userid) DO NOTHING;

INSERT INTO focus_information (userid, time, focus_time_seconds, category) VALUES
    ('user1', '2025-01-01 10:00:00', 3600, 'Work'),
    ('user1', '2025-01-01 15:00:00', 1800, 'Study'),
    ('user2', '2025-01-01 09:00:00', 7200, 'Work')
ON CONFLICT (userid, time) DO NOTHING;

INSERT INTO focus_goal_information (userid, category, goal_time_per_week_seconds) VALUES
    ('user1', 'Work', 144000),      -- 40 hours per week
    ('user1', 'Study', 36000),      -- 10 hours per week
    ('user2', 'Work', 180000)       -- 50 hours per week
ON CONFLICT (userid, category) DO NOTHING;

-- Grant privileges (if needed)
-- GRANT ALL PRIVILEGES ON DATABASE app_db TO postgres;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
