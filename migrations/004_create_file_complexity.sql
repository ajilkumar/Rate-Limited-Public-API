-- =============================================
-- Migration: Create File Complexity Table
-- Version: 004
-- Description: Stores code complexity metrics per file
-- =============================================

CREATE TABLE file_complexity (
    -- Primary identification
    id BIGSERIAL PRIMARY KEY,
    
    -- Foreign key to repository
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    
    -- File information
    file_path VARCHAR(500) NOT NULL,
    language VARCHAR(50),
    
    -- Complexity metrics
    lines_of_code INTEGER DEFAULT 0,
    cyclomatic_complexity INTEGER DEFAULT 0,
    cognitive_complexity INTEGER DEFAULT 0,
    function_count INTEGER DEFAULT 0,
    
    -- Timestamp
    analyzed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Find all files for a repository
CREATE INDEX idx_file_complexity_repo ON file_complexity(repository_id);

-- Filter by language
CREATE INDEX idx_file_complexity_language ON file_complexity(repository_id, language);

-- Find most complex files
CREATE INDEX idx_file_complexity_complex 
    ON file_complexity(repository_id, cyclomatic_complexity DESC);

-- One entry per file (latest analysis)
CREATE UNIQUE INDEX idx_file_unique 
    ON file_complexity(repository_id, file_path);

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE file_complexity IS 'Code complexity metrics calculated per file';
COMMENT ON COLUMN file_complexity.cyclomatic_complexity IS 'Number of decision points (if/while/for/case)';
COMMENT ON COLUMN file_complexity.cognitive_complexity IS 'Measure of how difficult code is to understand';