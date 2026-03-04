# Navigation Extension

A VS Code extension for enhanced navigation capabilities.

## Features

- **Word Bookmarking**: Bookmark any word or selected text in your files
- **History Stack**: Maintains a history of bookmarked items (up to 100)
- **Quick Navigation**: Jump back to any bookmarked location
- **Keyboard Shortcuts**: Fast access with customizable key bindings
- TypeScript support
- Ready for development

### Bookmark Commands

- `Bookmark Word/Selection` (`Cmd+Shift+B` on Mac, `Ctrl+Shift+B` on Windows/Linux)
  - Bookmarks the word under cursor or selected text
  - Stores file location, line, and timestamp
  
- `Show Bookmark History` (`Cmd+Shift+H` on Mac, `Ctrl+Shift+H` on Windows/Linux)  
  - Shows a quick pick list of all bookmarks
  - Navigate to any bookmark by selecting it
  - Displays file path, line number, and timestamp
  
- `Clear Bookmark History`
  - Removes all bookmarks from history
  - Requires confirmation before clearing

## Development

1. Install dependencies:
   ```
   npm install
   ```

2. Compile TypeScript:
   ```
   npm run compile
   ```

3. Run the extension:
   - Press `F5` to open a new Extension Development Host window
   - Try the bookmark commands:
     - Use `Cmd+Shift+B` to bookmark a word under cursor
     - Use `Cmd+Shift+H` to view bookmark history
     - Run commands from Command Palette: `Bookmark Word/Selection`, `Show Bookmark History`

## Structure

- `src/extension.ts` - Main extension file
- `package.json` - Extension manifest
- `tsconfig.json` - TypeScript configuration