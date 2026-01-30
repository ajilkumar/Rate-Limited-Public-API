-- =============================================
-- Migration: Create API Keys Table
-- Version: 001
-- Description: Stores API key information for authentication
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE api_keys (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Security: NEVER store raw keys, only hashes
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    
    -- Display prefix for user convenience (e.g., "sk_free_abc1")
    key_prefix VARCHAR(12) NOT NULL,
    
    -- User identification
    user_email VARCHAR(255) NOT NULL,
    
    -- User-defined name for the key
    name VARCHAR(255),
    
    -- Tier determines rate limits
    tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    
    -- Rate limiting configuration
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 100,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Flexible JSONB field for additional metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================
-- INDEXES for performance
-- =============================================

-- Fast lookup during authentication (most important!)
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- Find all keys for a user
CREATE INDEX idx_api_keys_user_email ON api_keys(user_email);

-- Filter active keys efficiently
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = true;

-- Filter by tier
CREATE INDEX idx_api_keys_tier ON api_keys(tier);

-- =============================================
-- COMMENTS for documentation
-- =============================================

COMMENT ON TABLE api_keys IS 'Stores API key information for authentication and rate limiting';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key - NEVER store raw keys';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 12 characters of the key for display (e.g., sk_free_abc1)';
COMMENT ON COLUMN api_keys.tier IS 'Subscription tier: free (100/hr), pro (1000/hr), enterprise (10000/hr)';
COMMENT ON COLUMN api_keys.metadata IS 'Flexible JSON field for additional data (company name, notes, etc.)';