<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use OCP\Config\IUserConfig;
use OCP\Config\ValueType;

/** Migrates Taskbook's legacy mixed user preferences lazily to typed values. */
class UserConfigService {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private IUserConfig $config,
	) {
	}

	public function getString(string $uid, string $app, string $key, string $default): string {
		if (!$this->config->hasKey($uid, $app, $key)) {
			return $default;
		}
		if ($this->config->getValueType($uid, $app, $key) === ValueType::MIXED) {
			$value = $this->legacyValue($uid, $app, $key);
			$result = is_string($value) ? $value : $default;
			$this->config->deleteUserConfig($uid, $app, $key);
			$this->config->setValueString($uid, $app, $key, $result);
			return $result;
		}
		return $this->config->getValueString($uid, $app, $key, $default);
	}

	public function setString(string $uid, string $app, string $key, string $value): void {
		$this->migrateMixed($uid, $app, $key);
		$this->config->setValueString($uid, $app, $key, $value);
	}

	public function getBool(string $uid, string $app, string $key, bool $default): bool {
		if (!$this->config->hasKey($uid, $app, $key)) {
			return $default;
		}
		if ($this->config->getValueType($uid, $app, $key) === ValueType::MIXED) {
			$value = $this->legacyValue($uid, $app, $key);
			$result = $value === true || $value === '1';
			$this->config->deleteUserConfig($uid, $app, $key);
			$this->config->setValueBool($uid, $app, $key, $result);
			return $result;
		}
		return $this->config->getValueBool($uid, $app, $key, $default);
	}

	public function setBool(string $uid, string $app, string $key, bool $value): void {
		$this->migrateMixed($uid, $app, $key);
		$this->config->setValueBool($uid, $app, $key, $value);
	}

	/** @return list<int> */
	public function getDays(string $uid, string $app, string $key, array $default): array {
		if (!$this->config->hasKey($uid, $app, $key)) {
			return $default;
		}
		if ($this->config->getValueType($uid, $app, $key) === ValueType::MIXED) {
			$value = $this->legacyValue($uid, $app, $key);
			$result = is_string($value) ? array_map(static fn (string $day): int => (int)$day, explode(',', $value)) : $default;
			$this->config->deleteUserConfig($uid, $app, $key);
			$this->config->setValueArray($uid, $app, $key, $result);
			return $result;
		}
		/** @var list<int> $result */
		$result = $this->config->getValueArray($uid, $app, $key, $default);
		return $result;
	}

	/** @param list<int> $value */
	public function setDays(string $uid, string $app, string $key, array $value): void {
		$this->migrateMixed($uid, $app, $key);
		$this->config->setValueArray($uid, $app, $key, $value);
	}

	private function migrateMixed(string $uid, string $app, string $key): void {
		if ($this->config->hasKey($uid, $app, $key) && $this->config->getValueType($uid, $app, $key) === ValueType::MIXED) {
			$this->config->deleteUserConfig($uid, $app, $key);
		}
	}

	private function legacyValue(string $uid, string $app, string $key): mixed {
		return $this->config->getValues($uid, $app)[$key] ?? null;
	}
}
