import React from 'react';
import { motion } from 'framer-motion';

interface ScoreBadgeProps {
    score: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    const targetStrokeDashoffset = circumference - (score / 100) * circumference;

    let strokeColorClass = 'text-red-500';
    if (score >= 50) strokeColorClass = 'text-yellow-500';
    if (score >= 80) strokeColorClass = 'text-green-500';

    return (
        <div className="relative inline-flex items-center justify-center w-[60px] h-[60px]">
            <svg className="w-full h-full -rotate-90">
                {/* Background track circle */}
                <circle
                  cx="30"
                  cy="30"
                  r={radius}
                  fill="none"
                  className="stroke-slate-200 dark:stroke-slate-700/50"
                  strokeWidth="3.5"
                />
                {/* Animated progress circle */}
                <motion.circle
                  cx="30"
                  cy="30"
                  r={radius}
                  fill="none"
                  className={strokeColorClass}
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: targetStrokeDashoffset }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </svg>
            <span className="absolute font-bold text-lg text-slate-800 dark:text-slate-200">
                {score}
            </span>
        </div>
    );
}
