import { NativeModule } from '../nativeModule';
import { LineColumnInfo } from '../../modules/selection/types';

export interface EditorTextChange {
  from: CodeGen_Int;
  to: CodeGen_Int;
  insert: string;
}

/**
 * @shouldExport true
 * @invokePath core
 * @bridgeName NativeBridgeCore
 */
export interface NativeModuleCore extends NativeModule {
  notifyWindowDidLoad(): void;
  notifyWindowResize(args: { method: 'to' | 'by'; width: number; height: number }): void;
  notifyWindowMove(args: { method: 'to' | 'by'; x: number; y: number }): void;
  notifyWindowClose(): void;
  notifyEditorDidBecomeIdle(): void;
  notifyBackgroundColorDidChange(args: { color: CodeGen_Int; alpha: number }): void;
  notifyViewportScaleDidChange(): void;
  notifyViewDidUpdate(args: { contentEdited: boolean; compositionEnded: boolean; isDirty: boolean; selectedLineColumn: LineColumnInfo }): void;
  notifyTextChanged(args: { revision: CodeGen_UInt64; changes: EditorTextChange[]; compositionEnded: boolean }): void;
  notifyContentHeightDidChange({ bottomPanelHeight }: { bottomPanelHeight: number }): void;
  notifyContentOffsetDidChange({ sourcePosition }: { sourcePosition: CodeGen_Int }): void;
  notifyCompositionEnded({ selectedLineColumn }: { selectedLineColumn: LineColumnInfo }): void;
  notifyLinkClicked({ link }: { link: string }): void;
  notifyLightWarning(): void;
}
