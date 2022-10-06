// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import pkg from './package.json';
//
const name = pkg.name
	.replace(/^\w/, m => m.toUpperCase())
	.replace(/-\w/g, m => m[1].toUpperCase());


export default {
	input: 'module/main.js',
	output: [
		{ file: pkg.module, 'format': 'es', name }
	],
	plugins: [
		resolve({'preferBuiltins': false})
	]
  };
  