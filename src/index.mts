#!/usr/bin/env node

import { createProgram } from './cli/commands.mjs';

const program = createProgram();
program.parse(process.argv);
