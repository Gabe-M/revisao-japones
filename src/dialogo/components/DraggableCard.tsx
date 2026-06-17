import React, { useState, useRef } from 'react';

interface DraggableCardProps {
    card: any;
    onClose: () => void;
    initialIndex: number;
}

export default function DraggableCard({ card, onClose, initialIndex }: DraggableCardProps) {
    const [pos, setPos] = useState({ x: Math.max(50, window.innerWidth / 2 - 150 + initialIndex * 30), y: Math.max(50, 100 + initialIndex * 30) });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number, startY: number, startPosX: number, startPosY: number } | null>(null);

    const onPointerDown = (e: React.PointerEvent) => {
        // Only trigger drag if it's not the close button
        if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
        
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: pos.x,
            startPosY: pos.y
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPos({
            x: dragRef.current.startPosX + dx,
            y: dragRef.current.startPosY + dy
        });
    };

    const onPointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        dragRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <div 
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
                position: 'fixed',
                left: pos.x,
                top: pos.y,
                zIndex: 10000 + initialIndex,
                background: 'var(--card-bg)', 
                border: '2px solid var(--highlight-color)', 
                borderRadius: '16px', 
                padding: '20px', 
                width: '300px', 
                boxShadow: isDragging ? '0 15px 35px rgba(0,0,0,0.4)' : '0 10px 25px rgba(0,0,0,0.2)', 
                display: 'flex', 
                flexDirection: 'column',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                transition: isDragging ? 'none' : 'box-shadow 0.2s',
                animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
            }}
        >
            <style>
                {`
                    @keyframes popIn {
                        0% { transform: scale(0.9) translateY(10px); opacity: 0; }
                        100% { transform: scale(1) translateY(0); opacity: 1; }
                    }
                `}
            </style>
            <button 
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={(e) => { e.stopPropagation(); onClose(); }} 
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-color)', fontSize: '1.2em', cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseOver={e => e.currentTarget.style.transform='scale(1.2)'} 
                onMouseOut={e => e.currentTarget.style.transform='scale(1)'}
            >
                &times;
            </button>
            <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: '2em', textAlign: 'center', margin: '5px 0', fontWeight: 800, color: 'var(--primary-color)' }}>
                {card.item}
            </div>
            {card.leitura && (
                <div style={{ textAlign: 'center', fontSize: '1em', color: 'gray', fontWeight: 600, letterSpacing: '1px', marginBottom: '10px' }}>
                    {card.leitura}
                </div>
            )}
            
            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--highlight-color)', marginBottom: '15px' }}>
                <div style={{ fontSize: '0.75em', textTransform: 'uppercase', color: 'gray', fontWeight: 700, marginBottom: '5px' }}>Descrição / Significado:</div>
                <div style={{ fontWeight: 600, fontSize: '1em', color: 'var(--text-color)' }}>
                    {card.significado}
                </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <span style={{ background: 'rgba(52, 73, 94, 0.1)', color: 'var(--secondary-color)', padding: '4px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '0.7em', textTransform: 'uppercase' }}>
                    {card.tipo || 'Vocabulário'}
                </span>
                {card.jlpt && (
                    <span style={{ backgroundColor: 'rgba(230, 126, 34, 0.12)', color: 'var(--highlight-color)', padding: '4px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '0.7em' }}>
                        {card.jlpt}
                    </span>
                )}
            </div>
        </div>
    );
}
