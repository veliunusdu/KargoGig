# @kargogig/config

Shared configuration files for the KargoGig monorepo.

## Usage

### ESLint

**For Next.js apps:**

```js
// .eslintrc.js
module.exports = {
  extends: ['@kargogig/config/eslint/nextjs'],
};
```

**For Node.js/NestJS:**

```js
// .eslintrc.js
module.exports = {
  extends: ['@kargogig/config/eslint/base'],
};
```

### TypeScript

**For Next.js apps:**

```json
// tsconfig.json
{
  "extends": "@kargogig/config/typescript/nextjs.json",
  "compilerOptions": {
    // your overrides
  }
}
```

**For Node.js/NestJS:**

```json
// tsconfig.json
{
  "extends": "@kargogig/config/typescript/base.json",
  "compilerOptions": {
    // your overrides
  }
}
```

### Prettier

```json
// .prettierrc.js or package.json
{
  "prettier": "@kargogig/config/prettier/.prettierrc.js"
}
```
