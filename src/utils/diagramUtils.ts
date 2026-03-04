import * as vscode from 'vscode';
import { BookmarkItem } from '../types/bookmarkTypes';

export function getDiagramWebviewContent(bookmarks: BookmarkItem[]): string {
    const generateNodesAndEdges = (items: BookmarkItem[], parentId?: string, level: number = 0) => {
        const nodes: any[] = [];
        const edges: any[] = [];
        let nodeIndex = 0;
        
        const processBookmark = (bookmark: BookmarkItem, x: number, y: number, parentNodeId?: string) => {
            const nodeId = `node-${bookmark.filePath}-${bookmark.line}-${bookmark.character}`;
            const hasChildren = bookmark.children && bookmark.children.length > 0;
            
            nodes.push({
                id: nodeId,
                type: hasChildren ? 'input' : 'default',
                data: {
                    label: `📁 ${bookmark.text}\n${vscode.workspace.asRelativePath(bookmark.filePath)}:${bookmark.line + 1}`,
                    bookmarkData: {
                        text: bookmark.text,
                        filePath: bookmark.filePath,
                        line: bookmark.line,
                        character: bookmark.character,
                        timestamp: bookmark.timestamp
                    }
                },
                position: { x, y },
                style: {
                    background: hasChildren ? '#e1f5fe' : '#f3e5f5',
                    color: '#333',
                    border: hasChildren ? '2px solid #0277bd' : '1px solid #7b1fa2',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '12px',
                    minWidth: '200px'
                }
            });
            
            if (parentNodeId) {
                edges.push({
                    id: `edge-${parentNodeId}-${nodeId}`,
                    source: parentNodeId,
                    target: nodeId,
                    type: 'smoothstep',
                    style: { stroke: '#666' }
                });
            }
            
            if (bookmark.children) {
                bookmark.children.forEach((child, index) => {
                    const childX = x + (index - (bookmark.children!.length - 1) / 2) * 250;
                    const childY = y + 150;
                    processBookmark(child, childX, childY, nodeId);
                });
            }
        };
        
        items.forEach((bookmark, index) => {
            const x = index * 300;
            const y = 50;
            processBookmark(bookmark, x, y);
        });
        
        return { nodes, edges };
    };
    
    const { nodes, edges } = generateNodesAndEdges(bookmarks);
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Interactive Bookmark Diagram</title>
            <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
            <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
            <script src="https://unpkg.com/reactflow@11/dist/umd/index.js"></script>
            <link rel="stylesheet" href="https://unpkg.com/reactflow@11/dist/style.css" />
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    height: 100vh;
                    overflow: hidden;
                }
                .diagram-container {
                    width: 100vw;
                    height: 100vh;
                    background: var(--vscode-editor-background);
                }
                .react-flow__node {
                    font-size: 12px;
                }
                .react-flow__controls {
                    bottom: 20px;
                    left: 20px;
                }
                .react-flow__minimap {
                    bottom: 20px;
                    right: 20px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-widget-border);
                }
                .toolbar {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    z-index: 1000;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 4px;
                    padding: 8px;
                }
                .stats {
                    background: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    margin-bottom: 8px;
                }
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div id="root"></div>
            
            <script>
                const { useState, useCallback } = React;
                const ReactFlow = window.ReactFlow;
                const { MiniMap, Controls, Background } = ReactFlow;
                
                const initialNodes = ${JSON.stringify(nodes)};
                const initialEdges = ${JSON.stringify(edges)};
                
                function BookmarkDiagram() {
                    const [nodes, setNodes] = useState(initialNodes);
                    const [edges, setEdges] = useState(initialEdges);
                    
                    const onNodesChange = useCallback((changes) => {
                        setNodes((nds) => ReactFlow.applyNodeChanges(changes, nds));
                    }, []);
                    
                    const onEdgesChange = useCallback((changes) => {
                        setEdges((eds) => ReactFlow.applyEdgeChanges(changes, eds));
                    }, []);
                    
                    const onNodeClick = useCallback((event, node) => {
                        console.log('Node clicked:', node.data.bookmarkData);
                        // Could send message to VS Code to navigate to bookmark
                    }, []);
                    
                    if (nodes.length === 0) {
                        return React.createElement('div', { className: 'empty-state' }, [
                            React.createElement('h2', { key: 'title' }, '📋 No bookmarks found'),
                            React.createElement('p', { key: 'description' }, 'Create some bookmarks to see the interactive diagram!')
                        ]);
                    }
                    
                    return React.createElement('div', { className: 'diagram-container' }, [
                        React.createElement('div', { key: 'toolbar', className: 'toolbar' }, [
                            React.createElement('div', { key: 'stats', className: 'stats' }, 
                                \`📊 ${nodes.length} bookmark\${nodes.length === 1 ? '' : 's'} • Interactive Diagram\`
                            ),
                            React.createElement('div', { key: 'instructions', style: { fontSize: '11px', opacity: 0.8 } }, 
                                '💡 Drag nodes • Zoom with mouse wheel • Use controls to fit view'
                            )
                        ]),
                        React.createElement(ReactFlow.default, {
                            key: 'reactflow',
                            nodes: nodes,
                            edges: edges,
                            onNodesChange: onNodesChange,
                            onEdgesChange: onEdgesChange,
                            onNodeClick: onNodeClick,
                            fitView: true,
                            attributionPosition: 'bottom-left'
                        }, [
                            React.createElement(MiniMap, { 
                                key: 'minimap',
                                nodeColor: (node) => node.style?.background || '#e1f5fe'
                            }),
                            React.createElement(Controls, { key: 'controls' }),
                            React.createElement(Background, { 
                                key: 'background',
                                variant: 'dots',
                                gap: 12,
                                size: 1
                            })
                        ])
                    ]);
                }
                
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(React.createElement(BookmarkDiagram));
            </script>
        </body>
        </html>
    `;
}