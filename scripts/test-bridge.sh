#!/bin/bash
# Test script for Petra bridge features
# Usage: ./test-bridge.sh [test-note-path]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default test note
TEST_NOTE="${1:-extracted-links}"

echo "======================================"
echo "Petra Bridge Features Test Suite"
echo "======================================"
echo ""

# Change to CLI directory
cd "$(dirname "$0")/../packages/cli"

# Function to run test and capture result
run_test() {
    local name="$1"
    local cmd="$2"

    echo -n "Testing: $name ... "

    if output=$(eval "$cmd" 2>&1); then
        echo -e "${GREEN}✓ PASS${NC}"
        echo "$output" | head -10
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "$output" | head -5
        return 1
    fi
    echo ""
}

# Prerequisites
echo "=== Prerequisites ==="
echo ""

echo -n "Bridge health check: "
if curl -s http://localhost:27182/health | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Bridge not available${NC}"
    exit 1
fi

echo -n "Auth token exists: "
if [ -f ~/.petra/token ]; then
    TOKEN_SIZE=$(wc -c < ~/.petra/token | tr -d ' ')
    echo -e "${GREEN}✓${NC} ($TOKEN_SIZE bytes)"

    if [ "$TOKEN_SIZE" -lt 40 ]; then
        echo -e "${YELLOW}⚠ Warning: Token seems short (expected ~43 chars)${NC}"
    fi
else
    echo -e "${RED}✗ Token missing${NC}"
    exit 1
fi

echo ""

# Note Commands
echo "=== Note Commands (Bridge) ==="
echo ""

run_test "note backlinks" "bun run dev -- note backlinks '$TEST_NOTE'"
echo ""

run_test "note outlinks" "bun run dev -- note outlinks '$TEST_NOTE'"
echo ""

# Graph Commands
echo "=== Graph Commands (Bridge) ==="
echo ""

run_test "graph neighbors (default)" "bun run dev -- graph neighbors '$TEST_NOTE'"
echo ""

run_test "graph neighbors (incoming)" "bun run dev -- graph neighbors '$TEST_NOTE' --direction in"
echo ""

run_test "graph neighbors (outgoing)" "bun run dev -- graph neighbors '$TEST_NOTE' --direction out"
echo ""

run_test "graph neighbors (depth 2)" "bun run dev -- graph neighbors '$TEST_NOTE' --depth 2"
echo ""

run_test "graph query (basic)" "bun run dev -- graph query --json | head -20"
echo ""

run_test "graph query (from note)" "bun run dev -- graph query --from '$TEST_NOTE'"
echo ""

# Template Commands
echo "=== Template Commands (Bridge) ==="
echo ""

run_test "template list" "bun run dev -- template list"
echo ""

# Don't run template creation by default to avoid creating test files
echo -e "${YELLOW}Skipping: template run (would create files)${NC}"
echo ""

# Summary
echo "======================================"
echo "Test suite completed!"
echo "======================================"
