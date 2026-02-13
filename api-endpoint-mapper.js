const fs = require('fs');
const path = require('path');

const endpoints = [];
const routesDir = path.join(__dirname, 'routes');

if (!fs.existsSync(routesDir)) {
    console.error('Routes directory not found:', routesDir);
    process.exit(1);
}

const routeFiles = fs.readdirSync(routesDir);

routeFiles.forEach(file => {
    if (file.endsWith('.js')) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract routes using regex
        // Handles: router.get('/path', ...), router.post("/path", ...), etc.
        const routeMatches = content.match(/router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g);

        if (routeMatches) {
            routeMatches.forEach(match => {
                const parts = match.match(/router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/);
                if (parts) {
                    const method = parts[1].toUpperCase();
                    const route = parts[2];

                    // Determine base path based on file name or generic /api
                    let basePath = '/api';
                    if (file === 'index.js') {
                        basePath = '/api';
                    } else {
                        // Usually routes are mounted as router.use('/name', nameRoutes)
                        // For mapping purposes, we'll list them as found and then manually adjust if we know the mounting point
                        basePath = `/api/${file.replace('.js', '')}`;
                    }

                    endpoints.push({
                        method,
                        originalRoute: route,
                        file: file
                    });
                }
            });
        }
    }
});

console.log(JSON.stringify(endpoints, null, 2));
