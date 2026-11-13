-- Malaconda database (MySQL 8+ / MariaDB 10.6+). Money is stored as integer cents (CHF 39.00 -> 3900).
-- Run with: npm run migrate   (idempotent: every statement uses IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(190) NOT NULL UNIQUE,            -- lower-cased
  name          VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,                   -- scrypt, salted
  phone         VARCHAR(40)  NOT NULL DEFAULT '',
  address       VARCHAR(190) NOT NULL DEFAULT '',
  zip           VARCHAR(20)  NOT NULL DEFAULT '',
  city          VARCHAR(90)  NOT NULL DEFAULT '',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,                       -- sha-256 of the cookie value; the cookie itself is never stored
  user_id    BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ref               VARCHAR(16) NOT NULL UNIQUE,         -- shown to the customer, e.g. M-7K3Q9X
  user_id           BIGINT UNSIGNED NULL,                -- null = guest checkout
  email             VARCHAR(190) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  ship_address      VARCHAR(190) NOT NULL,
  ship_zip          VARCHAR(20)  NOT NULL,
  ship_city         VARCHAR(90)  NOT NULL,
  ship_phone        VARCHAR(40)  NOT NULL DEFAULT '',
  boxes             INT UNSIGNED NOT NULL,
  gross_cents       INT UNSIGNED NOT NULL,
  discount_cents    INT UNSIGNED NOT NULL DEFAULT 0,
  net_cents         INT UNSIGNED NOT NULL,               -- what is charged, VAT included
  welcome_pct       TINYINT UNSIGNED NOT NULL DEFAULT 0, -- first-order offer applied (accounts only)
  status            ENUM('pending','paid','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  stripe_session_id VARCHAR(120) NULL UNIQUE,
  stripe_payment_id VARCHAR(120) NULL,
  carrier           VARCHAR(60) NOT NULL DEFAULT '',
  tracking          VARCHAR(120) NOT NULL DEFAULT '',
  paid_at           DATETIME NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY (email), KEY (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_lines (
  order_id   BIGINT UNSIGNED NOT NULL,
  flavor     VARCHAR(20) NOT NULL,
  boxes      INT UNSIGNED NOT NULL,
  unit_cents INT UNSIGNED NOT NULL,                      -- price per box when ordered
  PRIMARY KEY (order_id, flavor),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stripe sends the same event more than once: the primary key makes processing idempotent.
CREATE TABLE IF NOT EXISTS stripe_events (
  id          VARCHAR(80) PRIMARY KEY,
  type        VARCHAR(80) NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_requests (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  topic      VARCHAR(20)  NOT NULL,
  message    TEXT NOT NULL,
  status     ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pro accounts: the prices a venue pays are held here, so the server prices pro orders itself (the browser is never trusted for money).
CREATE TABLE IF NOT EXISTS pros (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(190) NOT NULL UNIQUE,            -- lower-cased
  name          VARCHAR(120) NOT NULL,                   -- the venue
  contact       VARCHAR(120) NOT NULL DEFAULT '',
  phone         VARCHAR(40)  NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  address       VARCHAR(190) NOT NULL DEFAULT '',
  zip           VARCHAR(20)  NOT NULL DEFAULT '',
  city          VARCHAR(90)  NOT NULL DEFAULT '',
  price_lulo    DECIMAL(6,3) NULL,                       -- negotiated price per bottle, excl. VAT; null = list price
  price_guava   DECIMAL(6,3) NULL,
  tiers         TINYINT(1) NOT NULL DEFAULT 1,           -- volume discount applies
  extras        TINYINT(1) NOT NULL DEFAULT 1,           -- welcome offer / referral credit apply
  credit_pct    TINYINT UNSIGNED NOT NULL DEFAULT 0,     -- referral credit available on the next order
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  pro_id     BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (pro_id) REFERENCES pros(id) ON DELETE CASCADE,
  KEY (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_orders (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ref               VARCHAR(16) NOT NULL UNIQUE,         -- e.g. P-7K3Q9X
  pro_id            BIGINT UNSIGNED NOT NULL,
  email             VARCHAR(190) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  ship_address      VARCHAR(190) NOT NULL,
  ship_zip          VARCHAR(20)  NOT NULL,
  ship_city         VARCHAR(90)  NOT NULL,
  ship_phone        VARCHAR(40)  NOT NULL DEFAULT '',
  boxes             INT UNSIGNED NOT NULL,
  gross_cents       INT UNSIGNED NOT NULL,               -- at the pro's prices, excl. VAT
  tier_pct          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  tier_cents        INT UNSIGNED NOT NULL DEFAULT 0,
  welcome_pct       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  credit_pct        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  extra_cents       INT UNSIGNED NOT NULL DEFAULT 0,
  net_cents         INT UNSIGNED NOT NULL,               -- excl. VAT
  vat_cents         INT UNSIGNED NOT NULL,
  total_cents       INT UNSIGNED NOT NULL,               -- what is charged
  status            ENUM('pending','paid','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  stripe_payment_id VARCHAR(120) NULL,
  paid_at           DATETIME NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pro_id) REFERENCES pros(id),
  KEY (pro_id), KEY (stripe_payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_order_lines (
  order_id   BIGINT UNSIGNED NOT NULL,
  flavor     VARCHAR(20) NOT NULL,
  boxes      INT UNSIGNED NOT NULL,
  unit_milli INT UNSIGNED NOT NULL,                      -- price per bottle in thousandths of a franc (CHF 2.10 -> 2100)
  PRIMARY KEY (order_id, flavor),
  FOREIGN KEY (order_id) REFERENCES pro_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
