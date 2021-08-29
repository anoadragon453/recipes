import assert from 'assert';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const outDir = 'src';
const recipeDir = 'recipes';

// Required sections in the yml file
const REQUIRED_KEYS = [
    'category',
    'description',
    'ingredients',
    'steps',
    'title',
];


// /**
//  * 
//  * @param {Object} unordered    Sort an object alphabetically by key
//  * @returns {Object}            The object sorted
// */
// function sortObject(unordered) {
//     const ordered = Object.keys(unordered).sort().reduce(
//         (obj, key) => { 
//             obj[key] = unordered[key]; 
//             return obj;
//         }, 
//         {}
//     );
//     return ordered;
// }


(async() => {
    let summary = {};

    // Iterate over all recipes
    for (const recipeName of await fs.promises.readdir(recipeDir)) {
        // Get the name of the directory
        const outFileName = path.join(outDir, `${recipeName}.md`);
        const recipeFilePath = path.join(recipeDir, recipeName, 'recipe.yml');
        // console.log(`Generating ${recipeName} > ${outFileName}`);
        
        // Read recipe file and open out file
        const data = yaml.load(await fs.promises.readFile(recipeFilePath));
        const mdFile = fs.createWriteStream(outFileName);

        // Ensure required sections are in the yml file
        REQUIRED_KEYS.forEach(key => assert.ok(data[key]));

        // Save to summary Object
        if (!(data.category in summary)) {
            summary[data.category] = [];
        }
        summary[data.category].push({'name': recipeName, 'title': data.title});

        // Symlink images to src directory
        const files = fs.readdirSync(path.join(recipeDir, recipeName));
        const images = [];
        files.forEach(file => {
            if (file.endsWith('.jpg')) {
                const linkImageDir = path.resolve(path.join(outDir, 'images', recipeName));
                const linkSrc = path.resolve(path.join(recipeDir, recipeName, file));
                const linkDst = path.resolve(path.join(outDir, 'images', recipeName, file))

                // Delete and recreate recipe image directory
                try {
                    fs.rmdirSync(linkImageDir, { recursive: true });
                } catch(_) {};
                fs.mkdirSync(linkImageDir);
                
                // Delete the symlink if it exists
                try {                  
                    fs.unlinkSync(linkDst);
                } catch (_) {};

                // Symlink the image from the recipe directory to src
                fs.symlinkSync(linkSrc, linkDst);

                images.push(file);
            }
        });

        // Write markdown

        // Recipe header and description
        mdFile.write(`# ${data.title}\n\n`);
        mdFile.write(`${data.description}\n`);
        if (images.includes('header.jpg')) {
        mdFile.write(`![${data.title} header image](images/${recipeName}/header.jpg)`)}

        // Ingredients
        mdFile.write(`\n## Ingredients\n\n`);
        for (const ingredient of data.ingredients) {
            mdFile.write(`- ${ingredient.amount} ${ingredient.unit} ${ingredient.name}\n`);
        }

        // Steps
        mdFile.write(`\n## Steps\n\n`);
        for (const step of data.steps) {
            const time = step.time ? ` (${step.time})` : '';
            mdFile.write(`1. ${step.step}${time}`);

            if (step.image) {
                mdFile.write(`  \n![Step image ${step.image.replace('.jpg', '')}](images/${recipeName}/${step.image})\n`)
            } else {
                mdFile.write('\n');
            }
        }

        // Sources
        mdFile.write(`\n## Sources\n\n`);
        for (const source of data.sources || []) {
            mdFile.write(`- <${source}>\n`);
        }

        mdFile.close();
    }

    // Order children of each category
    // Object.keys(summary).forEach(category => {
    //     console.log(summary[category]);
    //     category = sortObject(summary[category]);
    //     console.log(summary[category]);

    //     // Order children of each sub_category
    //     Object.keys(category).forEach(sub_category => {
    //         category[sub_category] = sortObject(category[sub_category]);
    //     });
    // })

    // Write SUMMARY.md
    const summaryFilePath = path.join(outDir, 'SUMMARY.md');
    const summaryFile = fs.createWriteStream(summaryFilePath);
    summaryFile.write('- [Recipes](index.md)\n')

    // For each category
    Object.keys(summary).forEach(category => {
        const cat = summary[category];
        summaryFile.write(`\n# ${category}\n\n`)

        // For each recipe in the category
        Object.keys(cat).forEach(recipe => {
            const res = cat[recipe];
            summaryFile.write(`- [${res.title}](${res.name}.md)\n`)
        });
    });

    summaryFile.close();
})().catch((error) => {
    console.log(error);
    process.exit(1);
})
