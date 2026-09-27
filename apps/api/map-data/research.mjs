import { createMapProvider } from './provider.mjs';
import { applyMapped, MAP_SOURCE_URL, MAP_LICENCE_URL, MAP_SOURCE } from '../../../packages/preview/map-shape.mjs';

/** Compose an independent permitted dataset with the existing bounded AI pipeline.
 * Failure of AI cannot replace a successfully loaded footprint with a generic box. */
export function mapResearch(base, provider) {
  const referencesFor = mapped => mapped ? [
    { id:'map-ms', url:MAP_SOURCE_URL, title:MAP_SOURCE + ' / release ' + mapped.release },
    { id:'map-ms-license', url:MAP_LICENCE_URL, title:'Microsoft data licence: CDLA Permissive 2.0' },
    ...(mapped.scan ? [
      { id:'scan-ea', url:mapped.scan.sourceUrl, title:'Environment Agency LiDAR DSM / OGL-UK-3.0' },
      { id:'scan-ea-dtm', url:'https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc', title:'Environment Agency LiDAR DTM / OGL-UK-3.0' }
    ] : [])
  ] : [];
  return {
    configured: () => Boolean(base.configured() || provider.enabled()),
    aiConfigured: () => Boolean(base.configured()),
    mapDataEnabled: () => Boolean(provider.enabled()),
    async run(args) {
      const { name, postcode, signal, onProgress } = args;
      let mapped = args.spec.mapped || null, note = '', mapData = { state:'pending' };
      await onProgress({ stage:'research', message:'Looking for reusable building outlines and scan-derived heights. The initial estimate stays visible.' });
      try {
        const result = await provider.lookup(name, postcode, signal);
        signal.throwIfAborted();
        if (result.mapped) mapped = result.mapped;
        note = result.reason || '';
        mapData = { state:mapped ? 'available' : 'unavailable', cached:result.cached === true, candidates:result.candidates || 0,
          heightBasis:mapped?.heightBasis || 'unknown', note };
      } catch (error) {
        if (signal.aborted) throw error;
        mapData = { state:mapped ? 'previous-data-retained' : 'unavailable', code:/^MAP_[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'MAP_UNAVAILABLE', note:'Open map data did not finish. The previous estimate is retained.' };
        note = mapData.note + ' Diagnostic: ' + mapData.code + '.';
      }
      const mergeRefs = refs => [...referencesFor(mapped), ...(refs || []).filter(r => !/^map-ms|^scan-ea/.test(r.id))].slice(0, 24);
      const mappedSpec = spec => mapped ? applyMapped(spec, mapped) : { ...spec, assumptions:[...(spec.assumptions || []), note || 'Open map data was unavailable.'].slice(-30) };
      const initial = mappedSpec(args.spec);
      await onProgress({ stage:'research', message:mapped ? 'Mapped footprint ready. Height and building identity remain estimates; appearance research can refine the facade.' : note,
        spec:initial, basis:mapped ? 'map-based-estimate' : 'generic-starting-estimate', references:mergeRefs([]), mapData });
      if (!base.configured()) return { spec:initial, basis:mapped ? 'map-based-estimate' : 'generic-starting-estimate',
        references:mergeRefs([]), photos:[], usage:args.usage, mapData,
        message:mapped ? 'Map-based estimate saved without an AI charge. The building match, roof and internal layout are unverified.' : 'The starting estimate is saved. Open map data was unavailable and AI is not configured.' };
      // The exact source polygon is applied independently after every AI pass.
      const baseSpec = { ...initial }; delete baseSpec.mapped;
      const result = await base.run({ ...args, spec:baseSpec, onProgress: async progress => {
        signal.throwIfAborted();
        await onProgress({ ...progress, ...(progress.spec ? { spec:mappedSpec(progress.spec) } : {}),
          basis:mapped ? 'map-based-estimate' : progress.basis, references:mergeRefs(progress.references), mapData });
      } });
      return { ...result, spec:mappedSpec(result.spec), basis:mapped ? 'map-based-estimate' : result.basis,
        references:mergeRefs(result.references), mapData,
        message:mapped ? 'Map-based building estimate ready. Footprint retained; facade and floor divisions are estimates, not a survey.' : result.message };
    }
  };
}
export function createMappedResearch({ workspace, base, provider } = {}) {
  return mapResearch(base, provider || createMapProvider({ workspace }));
}
