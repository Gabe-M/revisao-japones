import React from 'react';
import { createRoot } from 'react-dom/client';
import DialoGoApp from './DialoGoApp';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<DialoGoApp />);
}
