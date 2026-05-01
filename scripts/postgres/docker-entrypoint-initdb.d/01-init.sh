#!/bin/bash
set -e

# PostgreSQL initialization script
# Creates three databases and applies schema + seed data for each

echo "=== A2UI PostgreSQL Initialization ==="

# Create databases
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE a2ui_core;
  CREATE DATABASE a2ui_food;
  CREATE DATABASE a2ui_campus;
EOSQL

echo "Databases created: a2ui_core, a2ui_food, a2ui_campus"

# Initialize core database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname a2ui_core -f /docker-entrypoint-initdb.d/sql/core-schema.sql
echo "Core schema applied"

# Initialize food database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname a2ui_food -f /docker-entrypoint-initdb.d/sql/food-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname a2ui_food -f /docker-entrypoint-initdb.d/sql/food-seed.sql
echo "Food schema and seed applied"

# Initialize campus database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname a2ui_campus -f /docker-entrypoint-initdb.d/sql/campus-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname a2ui_campus -f /docker-entrypoint-initdb.d/sql/campus-seed.sql
echo "Campus schema and seed applied"

echo "=== Initialization complete ==="
