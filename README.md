# Navigation Extension

A VS Code extension for enhanced navigation capabilities.

## Features

- **🎯 Bookmark Sidebar**: Dedicated activity bar panel for bookmark management
- **Word Bookmarking**: Bookmark any word or selected text in your files
- **History Stack**: Maintains a history of bookmarked items (up to 100)
- **Quick Navigation**: Click any bookmark to instantly jump to that location
- **GUI Management**: Visual tree view with context menus and toolbar actions
- **Keyboard Shortcuts**: Fast access with customizable key bindings
- **Smart Duplicate Handling**: Automatically removes duplicate bookmarks
- TypeScript support

### GUI Features

**📋 Bookmark Explorer Panel:**
- Dedicated sidebar panel in the Activity Bar
- Tree view showing all bookmarks with file paths and line numbers
- Hover tooltips with detailed bookmark information
- Visual bookmark icons and timestamps

**🎛️ Toolbar Actions:**
- **Add Bookmark** button - Bookmark current word/selection
- **Refresh** button - Refresh the bookmark list
- **Clear All** button - Remove all bookmarks (with confirmation)

**⚡ Context Menu Actions:**
- Right-click any bookmark to **Remove** individual items
- Click any bookmark to **Navigate** to that location

### Bookmark Commands

**GUI Access:**
- Open the **Bookmark Explorer** from the Activity Bar (bookmark icon)
- Use toolbar buttons for quick actions
- Right-click bookmarks for context menu options
- Click any bookmark to navigate instantly

**Keyboard Shortcuts:**
- `Bookmark Word/Selection` (`Cmd+Shift+B` on Mac, `Ctrl+Shift+B` on Windows/Linux)
  - Bookmarks the word under cursor or selected text
  - Stores file location, line, and timestamp
  
- `Show Bookmark History` (`Cmd+Shift+H` on Mac, `Ctrl+Shift+H` on Windows/Linux)  
  - Shows a quick pick list of all bookmarks (alternative to GUI)
  - Navigate to any bookmark by selecting it
  
- `Focus Bookmark Explorer` (`Cmd+Shift+E` on Mac, `Ctrl+Shift+E` on Windows/Linux)
  - Quickly focus the bookmark sidebar panel

**Command Palette:**
- `Clear All Bookmarks` - Removes all bookmarks with confirmation
- All bookmark commands available via Command Palette

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
   - Look for the **Bookmark** icon in the Activity Bar (left sidebar)
   - Try the bookmark features:
     - Use `Cmd+Shift+B` to bookmark a word under cursor
     - Check the Bookmark Explorer panel to see your bookmarks
     - Click any bookmark to navigate to that location
     - Use toolbar buttons for quick actions
     - Right-click bookmarks for context menu options

## Structure

- `src/extension.ts` - Main extension file
- `package.json` - Extension manifest
- `tsconfig.json` - TypeScript configuration