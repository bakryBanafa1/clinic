const fs = require('fs');
const path = require('path');

function checkFileWalk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory() && file !== 'node_modules') {
            checkFileWalk(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                if (importPath.startsWith('.')) {
                    const targetPath = path.resolve(path.dirname(fullPath), importPath);
                    let found = false;
                    const exts = ['', '.js', '.jsx', '.css', '/index.js', '/index.jsx'];
                    for (const ext of exts) {
                        if (fs.existsSync(targetPath + ext)) {
                            const dirname = path.dirname(targetPath + ext);
                            const basename = path.basename(targetPath + ext);
                            try {
                                const realFiles = fs.readdirSync(dirname);
                                if (!realFiles.includes(basename)) {
                                   console.error(`\n[CASE MISMATCH] Fix needed in file:\n${fullPath}\nImported: '${importPath}'\nBut actual file has different casing!`);
                                }
                            } catch (e) {}
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        console.error(`\n[NOT FOUND] Fix needed in file:\n${fullPath}\nImported: '${importPath}' -> File does not exist!`);
                    }
                }
            }
        }
    }
}
checkFileWalk(path.join(process.cwd(), 'client', 'src'));
console.log('Case check finished.');
