// Detailed 1:1 models for the Guimarães landmarks. One file per landmark,
// each exporting { [id]: builder } in the metric convention of
// src/models.js: builder.metric = true, drawn at 1:1 metres on the OSM
// outline, local +z the main front.
//
// Every id has a detailed builder here (the generic massing fallback was removed).
import castelo from './castelo.js';
import pacoDuques from './paco-duques.js';
import saoMiguel from './sao-miguel-castelo.js';
import oliveira from './oliveira.js';
import saoTiago from './sao-tiago.js';
import toural from './toural.js';
import penha from './penha.js';
import santosPassos from './santos-passos.js';
import saoFrancisco from './sao-francisco.js';
import albertoSampaio from './alberto-sampaio.js';
import muralha from './muralha.js';
import plataformaArtes from './plataforma-artes.js';
import couros from './couros.js';
import santaMarinha from './santa-marinha.js';
import estadio from './estadio-afonso-henriques.js';
import uminho from './uminho-azurem.js';
import briteiros from './briteiros.js';
import vilaFlor from './vila-flor.js';

export const builders = {
  ...castelo,
  ...pacoDuques,
  ...saoMiguel,
  ...oliveira,
  ...saoTiago,
  ...toural,
  ...penha,
  ...santosPassos,
  ...saoFrancisco,
  ...albertoSampaio,
  ...muralha,
  ...plataformaArtes,
  ...couros,
  ...santaMarinha,
  ...estadio,
  ...uminho,
  ...briteiros,
  ...vilaFlor,
};
