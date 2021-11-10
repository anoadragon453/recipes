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
    'sub_category',
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
    let summary = {
        'Breakfast': {},
        'Lunch': {},
        'Dinner': {},
        'Snacks': {},
    };

    // Iterate over all recipes
    for (const recipeName of await fs.promises.readdir(recipeDir)) {
        // Ignore the template recipe
        if (recipeName === '.DS_Store' || recipeName === 'template' ) {
            continue;
        }

        // Get the name of the directory
        const outFileName = path.join(outDir, `${recipeName}.md`);
        const recipeFilePath = path.join(recipeDir, recipeName, 'recipe.yml');
        
        // Read recipe file and open out file
        const data = yaml.load(await fs.promises.readFile(recipeFilePath));
        const mdFile = fs.createWriteStream(outFileName);

        // Ensure required sections are in the yml file
        REQUIRED_KEYS.forEach(key => assert.ok(data[key]));

        // Ensure category is valid
        assert.ok(data.category in summary, `The category '${data.category}' for recipe '${data.title}' is invalid.`);

        // Save to summary Object
        if (!(data.sub_category in summary[data.category])) {
            summary[data.category][data.sub_category] = {};
        }
        summary[data.category][data.sub_category][recipeName] = data.title;

        // Symlink images to src directory
        const files = fs.readdirSync(path.join(recipeDir, recipeName));
        const linkImageDir = path.resolve(path.join(outDir, 'images', recipeName));
        const images = [];

        // Delete and recreate recipe image directory
        try {
            fs.rmdirSync(linkImageDir, { recursive: true });
        } catch(_) {};
        fs.mkdirSync(linkImageDir);

        files.forEach(file => {
            if (file.endsWith('.jpg')) {
                const linkSrc = path.resolve(path.join(recipeDir, recipeName, file));
                const linkDst = path.resolve(path.join(linkImageDir, file))

                // Symlink the image from the recipe directory to src
                try {
                    fs.unlinkSync(linkDst);
                } catch (_) {};
                fs.symlinkSync(linkSrc, linkDst);

                images.push(file);
            }
        });

        // Write markdown

        // Recipe header and description
        mdFile.write(`# ${data.title}\n\n`);
        mdFile.write(`${data.description.trim()}\n\n`);

                // Header image
                if (images.includes('header.jpg')) {
                    mdFile.write(`![${data.title} header image](images/${recipeName}/header.jpg)\n\n`)
                }

        // Prep, cook, and cool times
        if (data.times) {
            let totalTime = 0;
            Object.keys(data.times).forEach(time => {
                const caps = time.charAt(0).toUpperCase() + time.slice(1);
                mdFile.write(`- ${caps} time: ${data.times[time]} minutes\n`);
                totalTime += data.times[time];
            });

            mdFile.write(`- Total time: ${totalTime} minutes\n\n`);
        }

        if (data.allergens) {
            mdFile.write('## Allergens\n\n');
            data.allergens.forEach(allergen => {
                mdFile.write(`- ${allergen}\n`);
            });
        }

        // Ingredients
        mdFile.write(`## Ingredients\n\n`);
        mdFile.write(`Serves ${data.servings}\n\n`)
        mdFile.write(`| Amount | Ingredient | Comment |\n`)
        mdFile.write(`| -----: | ---------- | ------- |\n`)
        for (const ingredient of data.ingredients) {
            // Writes - "1 Eggs" or "10 ml Milk" depending on if unit is set or not
            // mdFile.write(`- ${ingredient.amount} ${(ingredient.unit) || ''} ${ingredient.name}\n`);
            mdFile.write(`| ${ingredient.amount} ${(ingredient.unit) || ''} | ${ingredient.name} | ${(ingredient.comment) || ''} |\n`)
        }

        // Steps
        mdFile.write(`\n## Steps\n\n`);
        for (const step of data.steps) {
            let time = '';
            if (step.time) {
                time = ` (${step.time} minutes)`
            }
            else if (step.time_min && step.time_max) {
                time = ` (${step.time_min} - ${step.time_max} minutes)`
            }
            mdFile.write(`1. ${step.step}${time}`);

            if (step.image) {
                mdFile.write(`  \n    ![Step image ${step.image.replace('.jpg', '')}](images/${recipeName}/${step.image})\n`)
            } else {
                mdFile.write('\n');
            }
        }

        if (data.nutrition) {
            mdFile.write(`\n## Nutrition\n\n`)
            mdFile.write(`| Nutrition | Amount |\n`);
            mdFile.write(`| --------- | -----: |\n`);
            for (const itm of data.nutrition) {
                mdFile.write(`| ${itm.name} | ${itm.amount}|\n`)
            }
        }

        // Sources
        if (data.sources) {
            mdFile.write(`\n## Sources\n\n`);
            for (const source of data.sources) {
                mdFile.write(`- <${source}>\n`);
            }
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

        // Skip empty categories
        if (Object.entries(cat).length > 0) {
        summaryFile.write(`\n# ${category}\n\n`)

            // For each sub category
            Object.keys(cat).forEach(sub_category => {
                const sub = cat[sub_category];
                summaryFile.write(`- [${sub_category}]()\n`)

                // For each recipe in the category
                Object.keys(sub).forEach(recipe => {
                    summaryFile.write(`  - [${sub[recipe]}](${recipe}.md)\n`)
                });
            });
        }
    });

    summaryFile.close();
})().catch((error) => {
    console.log(error);
    process.exit(1);
})
