
CREATE TABLE IF NOT EXISTS ticker_stats (
    ticker      text        PRIMARY KEY,              
    hits        bigint      NOT NULL DEFAULT 0,        
    last_seen   timestamptz NOT NULL DEFAULT now()      
);


CREATE INDEX IF NOT EXISTS idx_ticker_stats_hits
    ON ticker_stats (hits DESC);


CREATE TABLE IF NOT EXISTS analysis (
    ticker             text          PRIMARY KEY,         
    analysis           jsonb         NOT NULL,             
    fundamentals       jsonb         NOT NULL,            
    price_at_analysis  numeric(14,4),                    
    generated_at       timestamptz   NOT NULL DEFAULT now()  
);


CREATE INDEX IF NOT EXISTS idx_analysis_generated_at
    ON analysis (generated_at);


CREATE TABLE IF NOT EXISTS daily_quota (
    ip_hash  text    NOT NULL,                       
    day      date    NOT NULL DEFAULT current_date,  
    count    integer NOT NULL DEFAULT 0,             
    PRIMARY KEY (ip_hash, day)
);