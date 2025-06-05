export const enum Runtime {
	NONE = 'none',
	QUARKUS = 'camel-quarkus',
	SPRING_BOOT = 'camel-spring-boot',
}

// {"runtime":"camel-quarkus","camelVersion":"4.10.2","camelQuarkusVersion":"3.20.0","quarkusVersion":"3.23.0"}
// {"runtime":"camel-spring-boot","camelVersion":"4.8.0.redhat-00022","springBootVersion":"3.3.6"}

export interface RuntimeInfo {
	runtime: Runtime;
	camelVersion: string;
	springBootVersion?: string;
	camelQuarkusVersion?: string;
	quarkusVersion?: string;
}
