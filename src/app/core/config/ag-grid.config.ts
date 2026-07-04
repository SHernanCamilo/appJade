import { ModuleRegistry, ClientSideRowModelModule, CommunityFeaturesModule } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from '@ag-grid-community/locale';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CommunityFeaturesModule
]);

/** Textos de AG Grid en español (filtros, menús, paginación, etc.) */
export const AG_GRID_LOCALE = AG_GRID_LOCALE_ES;
