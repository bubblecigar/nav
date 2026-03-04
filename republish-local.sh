#!/bin/bash

# Script to republish VS Code extension locally
echo "🔄 Republishing extension locally..."

# Step 1: Compile TypeScript
echo "📦 Compiling TypeScript..."
npm run compile
if [ $? -ne 0 ]; then
    echo "❌ Compilation failed!"
    exit 1
fi

# Step 2: Increment patch version automatically
echo "📈 Incrementing version..."
npm version patch --no-git-tag-version

# Step 3: Get the new version number
VERSION=$(node -p "require('./package.json').version")
echo "🏷️  New version: $VERSION"

# Step 4: Remove old VSIX files
echo "🗑️  Cleaning old packages..."
rm -f *.vsix

# Step 5: Package extension (auto-answer yes to all prompts)
echo "📦 Packaging extension..."
yes | vsce package
if [ $? -ne 0 ]; then
    echo "❌ Packaging failed!"
    exit 1
fi

# Step 6: Install in VS Code
VSIX_FILE="nav-extension-${VERSION}.vsix"
echo "⬇️  Installing ${VSIX_FILE}..."
code --install-extension "${VSIX_FILE}"
if [ $? -ne 0 ]; then
    echo "❌ Installation failed!"
    exit 1
fi

echo "✅ Extension successfully republished!"
echo "🎉 Installed: nav-extension v${VERSION}"
echo "💡 Restart VS Code to activate the updated extension"