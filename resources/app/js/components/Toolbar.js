import { html, useState, useEffect, useRef } from '../lib/preact.standalone.module.js';
import '../lib/tailwind.module.js';
import * as api from '../api.js';
import { PauseIcon, StopIcon, SaveIcon, GaugeIcon, ForwardIcon, PlayIcon } from '../icons.js';
import NavigationPanel from './NavigationPanel.js';
import InputStringModal from './InputStringModal.js';
import NotesModal from './NotesModal.js';
import CalculatorModal from './CalculatorModal.js';
import SettingsModal from './SettingsModal.js';
import Button from './Button.js';
import { insertCurrencySymbols } from './helpers.js';
import Modal from './Modal.js';
import HintLightbulb from './HintLightbulb.js';
import MacroIndicatorPanel from './MacroIndicatorPanel.js';

function CheatsMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);
    const cheatsEnabled = api.useGameStore(s => !!s.gameState.unethicalSetting);

    useEffect(() => {
        if (!isOpen) return;
        const onDocMouseDown = (e) => {
            if (!popoverRef.current) return;
            if (popoverRef.current.contains(e.target)) return;
            if (triggerRef.current && triggerRef.current.contains(e.target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [isOpen]);

    const handleCheat = (fn) => {
        setIsOpen(false);
        fn();
    };

    return html`
        <div style="position: relative; display: inline-block;">
            <div ref=${triggerRef} class="btn" onClick=${() => setIsOpen(prev => !prev)}>
                <span style="white-space: nowrap;">${insertCurrencySymbols("Cheats")}</span>
            </div>
            ${isOpen ? html`
                <div ref=${popoverRef} class="toolbar-menu-popover" style="position: absolute; top: 100%; left: 0; z-index: 99999999 !important; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--panel-border); border-radius: 4px; padding: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                    <${Button} class="toolbar-menu-item" onClick=${() => handleCheat(api.cheatDisableLawsuits)}>${insertCurrencySymbols("Disable Lawsuits")}<//>
                    <${Button} class="toolbar-menu-item" onClick=${() => handleCheat(api.cheatMergerInfo)}>${insertCurrencySymbols("Inside Info: Merger")}<//>
                    <${Button} class="toolbar-menu-item" onClick=${() => handleCheat(api.cheatEarningsInfo)}>${insertCurrencySymbols("Inside Info: Earnings")}<//>
                    <${Button} class="toolbar-menu-item" onClick=${() => handleCheat(api.cheatAddCash)}>${insertCurrencySymbols("Add/Subtract Cash")}<//>
                    ${cheatsEnabled ? html`
                        <div style="height: 1px; background: var(--panel-border); margin: 3px 0;"></div>
                        <${Button} class="toolbar-menu-item" onClick=${() => handleCheat(api.cheatDisable)}>${insertCurrencySymbols("Disable Cheats")}<//>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

function HamburgerMenu({ onOpenSettings }) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const onDocMouseDown = (e) => {
            if (!popoverRef.current) return;
            if (popoverRef.current.contains(e.target)) return;
            if (triggerRef.current && triggerRef.current.contains(e.target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [isOpen]);

    const handleAction = (fn) => {
        setIsOpen(false);
        fn();
    };

    return html`
        <div style="position: relative; display: inline-block;">
            <div ref=${triggerRef} class="btn" onClick=${() => setIsOpen(prev => !prev)}
                 style="font-size: 18px; line-height: 1; padding: 0 8px;">
                ☰
            </div>
            ${isOpen ? html`
                <div ref=${popoverRef} class="toolbar-menu-popover" style="position: absolute; top: 100%; left: 0; z-index: 99999999 !important; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--panel-border); border-radius: 4px; padding: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                    <${Button} class="toolbar-menu-item" onClick=${() => handleAction(api.saveGame)}>${insertCurrencySymbols("Save Game")}<//>
                    <${Button} class="toolbar-menu-item" onClick=${() => handleAction(api.saveGameAs)}>${insertCurrencySymbols("Save As")}<//>
                    <${Button} class="toolbar-menu-item" onClick=${() => handleAction(api.exitGame)}>${insertCurrencySymbols("Exit Game")}<//>
                    <${Button} class="toolbar-menu-item" data-tutorial="settings-dropdown" onClick=${() => handleAction(onOpenSettings)}>${insertCurrencySymbols("Settings")}<//>
                </div>
            ` : ''}
        </div>
    `;
}

function Toolbar() {
    const [showNotepad, setShowNotepad] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showMacroPanel, setShowMacroPanel] = useState(false);

    return html`
        <div class="top-bar items-center justify-between" style="min-height: 44px; flex-shrink: 0;">
            <${NotesModal} show=${showNotepad} onClose=${() => setShowNotepad(false)} />
            <${CalculatorModal} show=${showCalculator} onClose=${() => setShowCalculator(false)} />
            <${SettingsModal} show=${showSettings} onClose=${() => setShowSettings(false)} />
            <${MacroIndicatorPanel} show=${showMacroPanel} onClose=${() => setShowMacroPanel(false)} />
            ${showAbout ? html`
                <${Modal} show=${showAbout} onClose=${() => setShowAbout(false)} hideHintLightbulb=${true} style=${{ "--modal-w": "400px", "--modal-h": "auto" }}>
                    <div style="padding: 24px; text-align: center;">
                        <h2 style="margin: 0 0 8px 0; font-size: 20px;">Wall Street Raider</h2>
                        <p style="margin: 0 0 4px 0; font-size: 14px; opacity: 0.8;">Version 10 Remastered — Early Access</p>
                        <p style="margin: 0 0 4px 0; font-size: 13px;">Copyright © 1986-${new Date().getFullYear()}, All Rights Reserved</p>
                        <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold;">HackJack Games & Ronin Software</p>
                        <p style="margin: 0 0 16px 0; font-size: 12px; opacity: 0.7;">The most realistic Wall Street simulation ever created</p>
                        <${Button} class="btn px-4 py-1" data-testid="btn-close-about" onClick=${() => setShowAbout(false)}>Close</button>
                    </div>
                <//>
            ` : ''}
            <div class="flex items-center gap-2" style="flex-shrink: 1; min-width: 0;">
                <${HamburgerMenu} onOpenSettings=${() => setShowSettings(true)} />
                <div class="flex flex-wrap items-center gap-2">
                    <div class="btn" data-tutorial="fullscreen-button" onClick=${() => api.toggleFullscreen()}>
                        <span style="white-space: nowrap;">${insertCurrencySymbols("Fullscreen")}</span>
                    </div>
                    <${HintLightbulb} />
                    <div class="btn" onClick=${() => window.open('assets/help/wsrbook.htm', '_blank')}>
                        <span style="white-space: nowrap;">${insertCurrencySymbols("Help")}</span>
                    </div>
                    <div class="btn" data-testid="btn-about" onClick=${() => setShowAbout(true)}>
                        <span style="white-space: nowrap;">${insertCurrencySymbols("About")}</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-2" style="flex-shrink: 1; min-width: 0;">
                <div class="btn" onClick=${() => api.changeLawFirm()}>
                    <span style="white-space: nowrap;">Change Law Firm</span>
                </div>
                <div class="btn" onClick=${() => api.toggleGlobalAutopilot()}>
                    <span style="white-space: nowrap;">${insertCurrencySymbols("Toggle Global Autopilot")}</span>
                </div>
                <${CheatsMenu} />
                <div class="btn" onClick=${() => setShowMacroPanel(true)} style="background:rgba(59,130,246,0.15); border-color:rgba(59,130,246,0.4);">
                    <span style="white-space: nowrap; color:#93c5fd;">${insertCurrencySymbols("📊 Macro Indicators")}</span>
                </div>
                <!--<div class="btn" data-testid="btn-end-turn" onClick=${() => api.checkScoreboard()}>
                    <span style="white-space: nowrap;">Scoreboard</span>
                </div>-->
            </div>
            <${NavigationPanel} />
        </div>
    `;
}

export default Toolbar;
