import React from 'react';
import { createRoot } from 'react-dom/client';
import DialoGoApp from './DialoGoApp';
import { TermCardProvider } from '../context/TermCardContext';
import TermCardModal from '../components/TermCardModal';
import '../index.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <TermCardProvider>
            <DialoGoApp />
            <TermCardModal />
        </TermCardProvider>
    );
}
