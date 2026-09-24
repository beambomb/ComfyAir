-- ComfyAir Database Schema 

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL ROLES
CREATE TABLE IF NOT EXISTS roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE, 
    description TEXT
);

-- 2. TABEL USERS
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID REFERENCES roles(role_id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 4. TABEL REFRESH_TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 5. TABEL USER_PREFERENCES
CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    ac_power_pk FLOAT NOT NULL DEFAULT 1.0, 
    electricity_rate_per_kwh DECIMAL(10, 2) NOT NULL DEFAULT 1444.70, 
    default_temperature INT NOT NULL DEFAULT 24,
    preferred_city VARCHAR(100) DEFAULT 'Yogyakarta',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL SLEEP_PROFILES
CREATE TABLE IF NOT EXISTS sleep_profiles (
    sleep_profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    profile_name VARCHAR(100) NOT NULL DEFAULT 'Weekday Sleep',
    bedtime TIME NOT NULL DEFAULT '22:00:00',
    wake_time TIME NOT NULL DEFAULT '06:00:00',
    start_temp INT NOT NULL DEFAULT 24,
    deep_sleep_temp INT NOT NULL DEFAULT 26,
    wake_temp INT NOT NULL DEFAULT 25,
    is_active BOOLEAN DEFAULT TRUE
);

-- 7. TABEL WEATHER_DATA
CREATE TABLE IF NOT EXISTS weather_data (
    weather_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_name VARCHAR(100) NOT NULL,
    outdoor_temp FLOAT NOT NULL,
    humidity FLOAT NOT NULL,
    weather_condition VARCHAR(100),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL TEMPERATURE_RECOMMENDATIONS
CREATE TABLE IF NOT EXISTS temperature_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    weather_id UUID REFERENCES weather_data(weather_id) ON DELETE SET NULL,
    recommended_setpoint INT NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('ECO', 'SLEEP', 'COMFORT')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABEL ENERGY_SAVING_LOGS
CREATE TABLE IF NOT EXISTS energy_saving_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    estimated_kwh_baseline FLOAT NOT NULL,
    estimated_kwh_optimized FLOAT NOT NULL,
    saved_cost_idr DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing untuk performa query
CREATE INDEX IF NOT EXISTS idx_weather_city ON weather_data(city_name, recorded_at);
CREATE INDEX IF NOT EXISTS idx_temp_rec_user ON temperature_recommendations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_energy_user_date ON energy_saving_logs(user_id, log_date);

-- Seeding data dasar role
INSERT INTO roles (name, description) 
VALUES 
    ('admin', 'Administrator dengan akses penuh'),
    ('user', 'Pengguna standar ComfyAir')
ON CONFLICT (name) DO NOTHING;
