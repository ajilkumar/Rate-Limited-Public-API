-- =============================================
-- Migration: Create API Usage Table
-- Version: 005
-- Description: Logs all API requests for analytics and monitoring
-- =============================================

CREATE TABLE api_usage (
    -- Primary identification
    id BIGSERIAL PRIMARY KEY,
    
    -- Foreign key to API key (nullable - logs exist even if key is deleted)
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    
    -- Request information
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    
    -- Performance tracking
    response_time_ms INTEGER,
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Error tracking
    error_message TEXT,
    
    -- Timestamp
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES (Time-series optimized)
-- =============================================

-- Most common query: usage by time range
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp DESC);

-- Usage by API key and time
CREATE INDEX idx_api_usage_api_key_timestamp 
    ON api_usage(api_key_id, timestamp DESC) 
    WHERE api_key_id IS NOT NULL;

-- Usage by endpoint
CREATE INDEX idx_api_usage_endpoint 
    ON api_usage(endpoint, timestamp DESC);

-- Error tracking
CREATE INDEX idx_api_usage_errors 
    ON api_usage(status_code, timestamp DESC) 
    WHERE status_code >= 400;

-- Performance monitoring
CREATE INDEX idx_api_usage_slow_requests 
    ON api_usage(response_time_ms DESC, timestamp DESC) 
    WHERE response_time_ms IS NOT NULL;

-- =============================================
-- PARTITIONING (Recommended for production)
-- =============================================

-- For high-volume APIs, partition by month:
-- ALTER TABLE api_usage PARTITION BY RANGE (timestamp);
-- 
-- CREATE TABLE api_usage_2026_01 PARTITION OF api_usage
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- 
-- CREATE TABLE api_usage_2026_02 PARTITION OF api_usage
--   FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE api_usage IS 'Logs all API requests for analytics, monitoring, and billing';
COMMENT ON COLUMN api_usage.api_key_id IS 'NULL if key was deleted or for anonymous requests';
COMMENT ON COLUMN api_usage.response_time_ms IS 'Response time in milliseconds for performance monitoring';