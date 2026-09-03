<?php

declare(strict_types=1);

namespace Controller;

use OCA\Taskbook\Controller\ContextController;
use OCA\Taskbook\Controller\EntryController;
use OCA\Taskbook\Controller\PageController;
use OCA\Taskbook\Controller\SettingsController;
use OCA\Taskbook\Controller\SyncController;
use OCA\Taskbook\Controller\ViewController;
use OCP\App\IAppManager;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\IURLGenerator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

final class PublicRouteBoundaryTest extends TestCase {
	/** @return iterable<string, array{string, string, string}> */
	public static function publicRoutes(): iterable {
		yield 'application shell' => ['pwa', 'GET', '/pwa/'];
		yield 'manifest' => ['manifest', 'GET', '/pwa/manifest.webmanifest'];
		yield 'service worker' => ['serviceWorker', 'GET', '/pwa/service-worker.js'];
	}

	#[DataProvider('publicRoutes')]
	public function testOnlyStaticShellRoutesExplicitlyAllowAnonymousGet(string $methodName, string $verb, string $url): void {
		$method = new ReflectionMethod(PageController::class, $methodName);
		$this->assertCount(1, $method->getAttributes(PublicPage::class));
		$this->assertCount(1, $method->getAttributes(NoCSRFRequired::class));
		$route = $method->getAttributes(FrontpageRoute::class)[0]->newInstance()->toArray();
		$this->assertSame($verb, $route['verb']);
		$this->assertSame($url, $route['url']);
	}

	public function testEveryTaskbookDataRouteRemainsAuthenticatedAndCsrfProtected(): void {
		$controllers = [EntryController::class, ContextController::class, SettingsController::class, ViewController::class, SyncController::class];
		foreach ($controllers as $controller) {
			foreach ((new ReflectionClass($controller))->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
				if ($method->getAttributes(ApiRoute::class) === []) {
					continue;
				}
				$this->assertSame([], $method->getAttributes(PublicPage::class), $controller . '::' . $method->getName() . ' must require authentication.');
				$this->assertSame([], $method->getAttributes(NoCSRFRequired::class), $controller . '::' . $method->getName() . ' must retain CSRF protection.');
			}
		}
	}

	public function testShellResponseContainsOnlyStaticAssetLocations(): void {
		$controller = $this->controller();
		$response = $controller->pwa();
		$this->assertSame(TemplateResponse::RENDER_AS_BLANK, $response->getRenderAs());
		$this->assertSame([
			'iconUrl' => '/apps/taskbook/img/pwa-192.png',
			'scriptUrl' => '/apps/taskbook/js/taskbook-pwa.mjs',
			'styleUrl' => '/apps/taskbook/css/taskbook-pwa.css',
			'buildVersion' => hash_file('sha256', dirname(__DIR__, 3) . '/js/taskbook-pwa.mjs'),
		], $response->getParams());
		$this->assertDoesNotMatchRegularExpression('/user|password|token|credential|context|entr|sync/i', json_encode($response->getParams(), JSON_THROW_ON_ERROR));
	}

	public function testManifestAndServiceWorkerCanBeRenderedWithoutAUserSession(): void {
		$controller = $this->controller();
		$manifest = $controller->manifest();
		$this->assertSame('application/manifest+json; charset=utf-8', $manifest->getHeaders()['Content-Type']);
		$this->assertSame('/apps/taskbook/pwa/', json_decode($manifest->render(), true, 8, JSON_THROW_ON_ERROR)['scope']);

		$worker = $controller->serviceWorker();
		$this->assertSame('application/javascript; charset=utf-8', $worker->getHeaders()['Content-Type']);
		$this->assertSame('/apps/taskbook/pwa/', $worker->getHeaders()['Service-Worker-Allowed']);
		$this->assertStringContainsString('"scopePath":"/apps/taskbook/pwa/"', $worker->render());
		$this->assertStringContainsString('"buildVersion":"' . hash_file('sha256', dirname(__DIR__, 3) . '/js/taskbook-pwa.mjs') . '"', $worker->render());
		$this->assertStringNotContainsString('appPassword', $worker->render());
		$appPath = dirname(__DIR__, 3);
		$shellFiles = [
			$appPath . '/js/taskbook-pwa-service-worker.mjs',
			$appPath . '/js/taskbook-pwa.mjs',
			$appPath . '/css/taskbook-pwa.css',
			$appPath . '/img/pwa-192.png',
			$appPath . '/img/pwa-512.png',
			$appPath . '/img/pwa-maskable-512.png',
			$appPath . '/templates/pwa.php',
			$appPath . '/lib/Controller/PageController.php',
		];
		$fingerprint = implode('', array_map(static fn (string $file): string => hash_file('sha256', $file), $shellFiles));
		$this->assertStringContainsString('"cacheName":"taskbook-pwa-' . hash('sha256', $fingerprint) . '"', $worker->render());
	}

	private function controller(): PageController {
		$urlGenerator = $this->createMock(IURLGenerator::class);
		$urlGenerator->method('imagePath')->willReturnCallback(static fn (string $app, string $file): string => '/apps/' . $app . '/img/' . $file);
		$urlGenerator->method('linkTo')->willReturnCallback(static fn (string $app, string $file): string => '/apps/' . $app . '/' . $file);
		$urlGenerator->method('linkToRoute')->willReturnCallback(static fn (string $route): string => match ($route) {
			'taskbook.page.pwa' => '/apps/taskbook/pwa/',
			'taskbook.page.manifest' => '/apps/taskbook/pwa/manifest.webmanifest',
			default => throw new \LogicException('Unexpected route.'),
		});
		$urlGenerator->method('getAbsoluteURL')->willReturnCallback(static fn (string $url): string => 'https://cloud.example.test' . $url);
		$appManager = $this->createMock(IAppManager::class);
		$appManager->method('getAppPath')->with('taskbook')->willReturn(dirname(__DIR__, 3));
		return new PageController($this->createMock(IRequest::class), $urlGenerator, $appManager);
	}
}
