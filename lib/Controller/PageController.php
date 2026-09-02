<?php

declare(strict_types=1);

namespace OCA\Taskbook\Controller;

use OCA\Taskbook\AppInfo\Application;
use OCP\App\IAppManager;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\OpenAPI;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\AppFramework\Http\DataDisplayResponse;
use OCP\AppFramework\Http\EmptyContentSecurityPolicy;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\IURLGenerator;

/**
 * @psalm-suppress UnusedClass
 */
class PageController extends Controller {
	public function __construct(
		IRequest $request,
		private IURLGenerator $urlGenerator,
		private IAppManager $appManager,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[OpenAPI(OpenAPI::SCOPE_IGNORE)]
	#[FrontpageRoute(verb: 'GET', url: '/')]
	public function index(): TemplateResponse {
		return new TemplateResponse(
			Application::APP_ID,
			'index',
		);
	}

	#[PublicPage]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[OpenAPI(OpenAPI::SCOPE_IGNORE)]
	#[FrontpageRoute(verb: 'GET', url: '/pwa/')]
	public function pwa(): TemplateResponse {
		$buildVersion = $this->pwaBuildVersion($this->appManager->getAppPath(Application::APP_ID));
		$response = new TemplateResponse(Application::APP_ID, 'pwa', [
			'iconUrl' => $this->urlGenerator->linkTo(Application::APP_ID, 'img/pwa-192.png'),
			'scriptUrl' => $this->urlGenerator->linkTo(Application::APP_ID, 'js/taskbook-pwa.mjs'),
			'styleUrl' => $this->urlGenerator->linkTo(Application::APP_ID, 'css/taskbook-pwa.css'),
			'buildVersion' => $buildVersion,
		], TemplateResponse::RENDER_AS_BLANK);
		$csp = new EmptyContentSecurityPolicy();
		$csp->addAllowedScriptDomain("'self'");
		$csp->addAllowedStyleDomain("'self'");
		$csp->addAllowedImageDomain("'self'");
		$csp->addAllowedConnectDomain("'self'");
		$csp->allowInlineStyle(false);
		$csp->addAllowedWorkerSrcDomain("'self'");
		$csp->addAllowedFrameAncestorDomain("'none'");
		$csp->addAllowedFormActionDomain("'none'");
		$response->setContentSecurityPolicy($csp);
		$response->addHeader('Cache-Control', 'no-cache');
		$response->addHeader('Referrer-Policy', 'no-referrer');
		$response->addHeader('X-Content-Type-Options', 'nosniff');
		return $response;
	}

	#[PublicPage]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[OpenAPI(OpenAPI::SCOPE_IGNORE)]
	#[FrontpageRoute(verb: 'GET', url: '/pwa/manifest.webmanifest')]
	public function manifest(): DataDisplayResponse {
		$pwaUrl = $this->urlGenerator->linkToRoute('taskbook.page.pwa');
		$manifest = [
			'name' => 'Taskbook',
			'short_name' => 'Taskbook',
			'display' => 'standalone',
			'start_url' => $pwaUrl,
			'scope' => $pwaUrl,
			'background_color' => '#ffffff',
			'theme_color' => '#ffffff',
			'icons' => [
				['src' => $this->urlGenerator->linkTo(Application::APP_ID, 'img/pwa-192.png'), 'sizes' => '192x192', 'type' => 'image/png'],
				['src' => $this->urlGenerator->linkTo(Application::APP_ID, 'img/pwa-512.png'), 'sizes' => '512x512', 'type' => 'image/png'],
				['src' => $this->urlGenerator->linkTo(Application::APP_ID, 'img/pwa-maskable-512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
			],
		];
		$response = new DataDisplayResponse(json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), headers: [
			'Content-Type' => 'application/manifest+json; charset=utf-8',
			'Cache-Control' => 'public, max-age=300',
			'X-Content-Type-Options' => 'nosniff',
		]);
		$response->setContentSecurityPolicy(new EmptyContentSecurityPolicy());
		return $response;
	}

	#[PublicPage]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[OpenAPI(OpenAPI::SCOPE_IGNORE)]
	#[FrontpageRoute(verb: 'GET', url: '/pwa/service-worker.js')]
	public function serviceWorker(): DataDisplayResponse {
		$pwaUrl = $this->urlGenerator->linkToRoute('taskbook.page.pwa');
		$scriptUrl = $this->urlGenerator->linkTo(Application::APP_ID, 'js/taskbook-pwa.mjs');
		$styleUrl = $this->urlGenerator->linkTo(Application::APP_ID, 'css/taskbook-pwa.css');
		$appPath = $this->appManager->getAppPath(Application::APP_ID);
		$buildVersion = $this->pwaBuildVersion($appPath);
		$workerPath = $appPath . '/js/taskbook-pwa-service-worker.mjs';
		$worker = file_get_contents($workerPath);
		if ($worker === false) {
			throw new \RuntimeException('The Taskbook PWA service worker has not been built.');
		}
		$assets = [
			$this->urlGenerator->getAbsoluteURL($pwaUrl),
			$this->urlGenerator->getAbsoluteURL($this->urlGenerator->linkToRoute('taskbook.page.manifest')),
			$this->urlGenerator->getAbsoluteURL($scriptUrl),
			$this->urlGenerator->getAbsoluteURL($styleUrl),
			$this->urlGenerator->getAbsoluteURL($this->urlGenerator->linkTo(Application::APP_ID, 'img/pwa-192.png')),
			$this->urlGenerator->getAbsoluteURL($this->urlGenerator->linkTo(Application::APP_ID, 'img/pwa-512.png')),
			$this->urlGenerator->getAbsoluteURL($this->urlGenerator->linkTo(Application::APP_ID, 'img/pwa-maskable-512.png')),
		];
		$shellFiles = [
			$workerPath,
			$appPath . '/js/taskbook-pwa.mjs',
			$appPath . '/css/taskbook-pwa.css',
			$appPath . '/img/pwa-192.png',
			$appPath . '/img/pwa-512.png',
			$appPath . '/img/pwa-maskable-512.png',
			$appPath . '/templates/pwa.php',
			__FILE__,
		];
		$shellFingerprint = '';
		foreach ($shellFiles as $shellFile) {
			$fileHash = hash_file('sha256', $shellFile);
			if ($fileHash === false) {
				throw new \RuntimeException('A Taskbook PWA shell asset is unavailable.');
			}
			$shellFingerprint .= $fileHash;
		}
		$scopePath = (string)parse_url($pwaUrl, PHP_URL_PATH);
		$configuration = [
			'cacheName' => 'taskbook-pwa-' . hash('sha256', $shellFingerprint),
			'buildVersion' => $buildVersion,
			'scopePath' => $scopePath,
			'shellUrl' => $assets[0],
			'assets' => $assets,
		];
		$source = 'globalThis.__TASKBOOK_PWA_CONFIG__=' . json_encode($configuration, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . ";\n" . $worker;
		$response = new DataDisplayResponse($source, headers: [
			'Content-Type' => 'application/javascript; charset=utf-8',
			'Cache-Control' => 'no-cache',
			'Service-Worker-Allowed' => $scopePath,
			'X-Content-Type-Options' => 'nosniff',
		]);
		$csp = new EmptyContentSecurityPolicy();
		$csp->addAllowedConnectDomain("'self'");
		$response->setContentSecurityPolicy($csp);
		return $response;
	}

	private function pwaBuildVersion(string $appPath): string {
		$hash = hash_file('sha256', $appPath . '/js/taskbook-pwa.mjs');
		if ($hash === false) {
			throw new \RuntimeException('The Taskbook PWA application has not been built.');
		}
		return $hash;
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[OpenAPI(OpenAPI::SCOPE_IGNORE)]
	#[FrontpageRoute(verb: 'GET', url: '/{path}', requirements: ['path' => '.+'])]
	public function deepLink(string $path): TemplateResponse {
		return new TemplateResponse(Application::APP_ID, 'index', ['path' => $path]);
	}
}
