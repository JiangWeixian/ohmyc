/* eslint-disable import/no-extraneous-dependencies */

import '@testing-library/jest-dom/vitest'

import { afterEach } from 'vitest'

import { resetTransportForTests } from '../src/lib/transport'
import { resetMock } from '../src/lib/transport/mock'

afterEach(() => {
  resetMock()
  resetTransportForTests()
})
