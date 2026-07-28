import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers)

// jsdom does not implement scrollIntoView; ChipRow uses it to centre the active chip.
Element.prototype.scrollIntoView = () => {}
