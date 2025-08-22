#!/bin/bash

# 🔧 CLEANUP SCRIPT - REMOVE DEBUG LOGS AFTER SETTINGS ISSUE IS FIXED 🔧
# This script removes all temporary debug logging added to investigate settings issues

echo "🧹 Cleaning up debug logs from jobRunner.js..."

# Remove debug log comment blocks and their contents
sed -i '' '/🔧 DEBUG LOGS - REMOVE AFTER SETTINGS ISSUE IS FIXED 🔧/,/🔧 END DEBUG LOGS 🔧/d' src/services/jobRunner.js

# Remove any remaining individual debug console.log statements
sed -i '' '/console\.log.*🔧/d' src/services/jobRunner.js
sed -i '' '/console\.log.*🔍 DEBUG/d' src/services/jobRunner.js

echo "✅ Debug logs cleaned up!"
echo "🔍 Review the file to ensure no debug logs remain"
echo "📝 Commit the cleanup: git add . && git commit -m 'cleanup: remove debug logs after settings issue resolution'"
