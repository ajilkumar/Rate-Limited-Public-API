-- =============================================
-- Migration: Create Repositories Table
-- Version: 002
-- Description: Stores GitHub repositories for analysis
-- =============================================

CREATE TABLE repositories (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Foreign key to API key (owner)
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- Repository information
    github_url VARCHAR(500) NOT NULL,
    owner VARCHAR(255) NOT NULL,  -- GitHub username or organization
    repo_name VARCHAR(255) NOT NULL,
    default_branch VARCHAR(100) DEFAULT 'main',
    
    -- Analysis tracking
    last_analyzed_at TIMESTAMP,
    analysis_status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Metadata from GitHub API
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================
-- INDEXES
-- =============================================

-- Unique repository per URL
CREATE UNIQUE INDEX idx_repos_github_url ON repositories(github_url);

-- Find all repos for an API key
CREATE INDEX idx_repos_api_key ON repositories(api_key_id);

-- Filter by status
CREATE INDEX idx_repos_status ON repositories(analysis_status);

-- Find repos by owner/name
CREATE INDEX idx_repos_owner_name ON repositories(owner, repo_name);

-- =============================================
-- CONSTRAINTS
-- =============================================

-- One API key can't register the same repo twice
CREATE UNIQUE INDEX idx_repos_unique_per_key ON repositories(api_key_id, github_url);

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE repositories IS 'GitHub repositories registered for analysis';
COMMENT ON COLUMN repositories.metadata IS 'GitHub API data: stars, forks, language, size, etc.';