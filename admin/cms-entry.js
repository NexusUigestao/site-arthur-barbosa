// Entrada do painel: empacota o Sveltia CMS (pacote npm) com todos os arquivos dele no próprio
// domínio. Nada vem de unpkg ou jsDelivr. A inicialização é explícita porque este arquivo não
// se chama sveltia-cms.js (o pacote só inicia sozinho nesse caso).
import { init } from '@sveltia/cms';

init();
