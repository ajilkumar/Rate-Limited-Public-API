#!/bin/bash

# Test Rate Limiting Script
# Usage: ./scripts/test-rate-limit.sh YOUR_API_KEY

API_KEY=$1

if [ -z "$API_KEY" ]; then
  echo "Error: API key required"
  echo "Usage: ./scripts/test-rate-limit.sh YOUR_API_KEY"
  exit 1
fi

BASE_URL="http://localhost:3000/api/v1"
ENDPOINT="$BASE_URL/auth/me"

echo "Testing rate limiting..."
echo "Endpoint: $ENDPOINT"
echo "API Key: ${API_KEY:0:15}..."
echo ""

# Make 105 requests (limit is 100/hour for free tier)
for i in {1..105}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$ENDPOINT" \
    -H "Authorization: Bearer $API_KEY")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  
  if [ $i -eq 1 ] || [ $i -eq 50 ] || [ $i -eq 99 ] || [ $i -eq 100 ] || [ $i -eq 101 ]; then
    echo "Request $i: HTTP $HTTP_CODE"
    
    # Show rate limit headers
    HEADERS=$(curl -s -I -X GET "$ENDPOINT" \
      -H "Authorization: Bearer $API_KEY" 2>/dev/null)
    
    LIMIT=$(echo "$HEADERS" | grep -i "x-ratelimit-limit" | cut -d' ' -f2 | tr -d '\r')
    REMAINING=$(echo "$HEADERS" | grep -i "x-ratelimit-remaining" | cut -d' ' -f2 | tr -d '\r')
    RESET=$(echo "$HEADERS" | grep -i "x-ratelimit-reset" | cut -d' ' -f2 | tr -d '\r')
    
    echo "  └─ Limit: $LIMIT, Remaining: $REMAINING, Reset: $RESET"
    
    # Show response body for rate limit errors
    if [ "$HTTP_CODE" -eq "429" ]; then
      echo "  └─ Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
    fi
    
    echo ""
  fi
  
  # Stop if we hit rate limit
  if [ "$HTTP_CODE" -eq "429" ]; then
    echo "Rate limit working! Got 429 after $i requests"
    echo ""
    echo "Final response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    break
  fi
  
  # Small delay to avoid overwhelming the server
  sleep 0.01
done

echo ""
echo "Test complete!"