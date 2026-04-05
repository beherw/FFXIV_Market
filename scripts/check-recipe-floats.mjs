import { decode } from '@msgpack/msgpack';
import { readFileSync } from 'fs';

const buf = readFileSync('public/data/recipes.msgpack');
const data = decode(buf);

const floatIngredients = [];
const floatRecipeFields = [];

for (const r of Object.values(data)) {
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'number' && !Number.isInteger(v)) {
      floatRecipeFields.push({ id: r.id, field: k, value: v });
    }
  }
  if (r.ingredients) {
    for (const ing of r.ingredients) {
      if (ing.quality && !Number.isInteger(ing.quality)) {
        floatIngredients.push({ recipeId: r.id, ingId: ing.id, quality: ing.quality });
        if (floatIngredients.length > 5) break;
      }
    }
  }
  if (floatIngredients.length > 5 && floatRecipeFields.length > 5) break;
}

console.log('Float ingredient quality samples:', floatIngredients.slice(0, 5));
console.log('Float recipe fields samples:', floatRecipeFields.slice(0, 5));
