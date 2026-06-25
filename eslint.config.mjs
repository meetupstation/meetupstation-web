import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'node_modules/**',
            '**/*.js'
        ]
    },

    ...tseslint.configs.recommended,

    {
        files: [
            '**/*.ts'
        ],

        languageOptions: {
            parser: tseslint.parser
        },

        rules: {
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-multi-spaces': 'error',
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],
            'keyword-spacing': 'error',
            'space-infix-ops': 'error',
            'space-before-blocks': 'error',
            'comma-dangle': ['error', 'never'],
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', {
                avoidEscape: true
            }],
            'indent': ['error', 4]
        }
    }
);