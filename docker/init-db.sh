#!/bin/bash
set -e

# Create bitespeed_test database (bitespeed is already created by POSTGRES_DB env var)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE bitespeed_test'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bitespeed_test')\gexec
EOSQL
