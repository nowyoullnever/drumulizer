import { contextBridge } from 'electron';
import { createDrumulizerApi } from './api';

contextBridge.exposeInMainWorld('drumulizer', createDrumulizerApi(process.platform));
