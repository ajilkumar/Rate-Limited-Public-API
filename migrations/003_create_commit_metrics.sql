-- =============================================
-- Migration: Create Commit Metrics Table
-- Version: 003
-- Description: Stores detailed commit history for analysis
-- =============================================

CREATE TABLE commit_metrics (
    -- Primary identification
    id BIGSERIAL PRIMARY KEY,
    
    -- Foreign key to repository
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    
    -- Commit information
    commit_sha VARCHAR(40) NOT NULL,
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    commit_date TIMESTAMP NOT NULL,
    
    -- Commit statistics
    files_changed INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_deleted INTEGER DEFAULT 0,
    
    -- Commit message
    message TEXT,
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES (Critical for time-series queries)
-- =============================================

-- Most common query: get commits for a repo in a date range
CREATE INDEX idx_commit_metrics_repo_date 
    ON commit_metrics(repository_id, commit_date DESC);

-- Query commits by author
CREATE INDEX idx_commit_metrics_author 
    ON commit_metrics(repository_id, author_email, commit_date DESC);

-- Prevent duplicate commits
CREATE UNIQUE INDEX idx_commit_unique 
    ON commit_metrics(repository_id, commit_sha);

-- Fast SHA lookup
CREATE INDEX idx_commit_sha ON commit_metrics(commit_sha);

-- =============================================
-- PARTITIONING (Future optimization)
-- =============================================

-- Note: For production with millions of commits,
-- consider partitioning by month:
-- CREATE TABLE commit_metrics_2026_01 PARTITION OF commit_metrics
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE commit_metrics IS 'Detailed commit history for repository analysis';
COMMENT ON COLUMN commit_metrics.commit_sha IS 'Git commit SHA-1 hash (40 characters)';
COMMENT ON INDEX idx_commit_metrics_repo_date IS 'Optimized for time-range queries (most common)';