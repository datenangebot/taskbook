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

	/**
	 * @param list<int> $default
	 * @return list<int>
	 */
	public function getDays(string $uid, string $app, string $key, array $default): array {
		if (!$this->config->hasKey($uid, $app, $key)) {
			return $default;
		}
		if ($this->config->getValueType($uid, $app, $key) === ValueType::MIXED) {
			$value = $this->legacyValue($uid, $app, $key);
			$result = is_string($value) ? $this->parseLegacyDays($value) : $default;
			$this->config->deleteUserConfig($uid, $app, $key);
			$this->config->setValueArray($uid, $app, $key, $result);
			return $result;
		}
		return $this->normalizeDays($this->config->getValueArray($uid, $app, $key, $default));
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

	/** @return string|int|float|bool|array<array-key, mixed>|null */
	private function legacyValue(string $uid, string $app, string $key): string|int|float|bool|array|null {
		/** @psalm-suppress MixedAssignment Values stored with Nextcloud's legacy mixed type may have any shape. */
		$value = $this->config->getValues($uid, $app)[$key] ?? null;
		if (is_string($value) || is_int($value) || is_float($value) || is_bool($value) || is_array($value)) {
			return $value;
		}
		return null;
	}

	/** @return list<int> */
	private function parseLegacyDays(string $value): array {
		$result = [];
		foreach (explode(',', $value) as $day) {
			$result[] = (int)$day;
		}
		return $result;
	}

	/**
	 * @param array<array-key, mixed> $days
	 * @return list<int>
	 */
	private function normalizeDays(array $days): array {
		$result = [];
		/** @psalm-suppress MixedAssignment Values from Nextcloud's untyped array config are narrowed below. */
		foreach ($days as $day) {
			if (is_int($day)) {
				$result[] = $day;
			}
		}
		return $result;
	}
}
