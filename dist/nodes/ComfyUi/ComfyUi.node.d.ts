import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
export declare class ComfyUi {
    description: {
        displayName: string;
        name: string;
        icon: string;
        iconColor: string;
        group: string[];
        version: number[];
        defaultVersion: number;
        description: string;
        defaults: {
            name: string;
        };
        usableAsTool: boolean;
        inputs: string[];
        outputs: string[];
        properties: ({
            displayName: string;
            name: string;
            type: string;
            required: boolean;
            default: string;
            description: string;
            options?: undefined;
            typeOptions?: undefined;
            placeholder?: undefined;
            hint?: undefined;
            displayOptions?: undefined;
            minValue?: undefined;
            maxValue?: undefined;
        } | {
            displayName: string;
            name: string;
            type: string;
            required: boolean;
            default: string;
            options: {
                name: string;
                value: string;
                action: string;
            }[];
            description?: undefined;
            typeOptions?: undefined;
            placeholder?: undefined;
            hint?: undefined;
            displayOptions?: undefined;
            minValue?: undefined;
            maxValue?: undefined;
        } | {
            displayName: string;
            name: string;
            type: string;
            typeOptions: {
                rows: number;
                multipleValues?: undefined;
                sortable?: undefined;
            };
            required: boolean;
            default: string;
            description: string;
            placeholder: string;
            hint: string;
            displayOptions: {
                show: {
                    action: string[];
                };
            };
            options?: undefined;
            minValue?: undefined;
            maxValue?: undefined;
        } | {
            displayName: string;
            name: string;
            type: string;
            default: number;
            description: string;
            minValue: number;
            maxValue: number;
            required?: undefined;
            options?: undefined;
            typeOptions?: undefined;
            placeholder?: undefined;
            hint?: undefined;
            displayOptions?: undefined;
        } | {
            displayName: string;
            name: string;
            type: string;
            typeOptions: {
                multipleValues: boolean;
                sortable: boolean;
                rows?: undefined;
            };
            description: string;
            displayOptions: {
                show: {
                    action: string[];
                };
            };
            default: {};
            options: {
                displayName: string;
                name: string;
                values: ({
                    displayName: string;
                    name: string;
                    type: string;
                    default: string;
                    description: string;
                    placeholder: string;
                    required: boolean;
                    options?: undefined;
                    displayOptions?: undefined;
                    typeOptions?: undefined;
                    hint?: undefined;
                } | {
                    displayName: string;
                    name: string;
                    type: string;
                    default: string;
                    description: string;
                    options: {
                        name: string;
                        value: string;
                        description: string;
                    }[];
                    placeholder?: undefined;
                    required?: undefined;
                    displayOptions?: undefined;
                    typeOptions?: undefined;
                    hint?: undefined;
                } | {
                    displayName: string;
                    name: string;
                    type: string;
                    default: string;
                    description: string;
                    placeholder: string;
                    displayOptions: {
                        show: {
                            parameterMode: string[];
                            type?: undefined;
                        };
                    };
                    required?: undefined;
                    options?: undefined;
                    typeOptions?: undefined;
                    hint?: undefined;
                } | {
                    displayName: string;
                    name: string;
                    type: string;
                    typeOptions: {
                        rows: number;
                    };
                    default: string;
                    description: string;
                    placeholder: string;
                    displayOptions: {
                        show: {
                            parameterMode: string[];
                            type?: undefined;
                        };
                    };
                    required?: undefined;
                    options?: undefined;
                    hint?: undefined;
                } | {
                    displayName: string;
                    name: string;
                    type: string;
                    default: string;
                    description: string;
                    options: {
                        name: string;
                        value: string;
                        description: string;
                    }[];
                    displayOptions: {
                        show: {
                            parameterMode: string[];
                            type?: undefined;
                        };
                    };
                    placeholder?: undefined;
                    required?: undefined;
                    typeOptions?: undefined;
                    hint?: undefined;
                } | {
                    displayName: string;
                    name: string;
                    type: string;
                    default: string;
                    description: string;
                    placeholder: string;
                    displayOptions: {
                        show: {
                            parameterMode: string[];
                            type: string[];
                        };
                    };
                    required?: undefined;
                    options?: undefined;
                    typeOptions?: undefined;
                    hint?: undefined;
                } | {
                    displayName: string;
                    name: string;
                    type: string;
                    default: string;
                    description: string;
                    placeholder: string;
                    displayOptions: {
                        show: {
                            parameterMode: string[];
                            type: string[];
                        };
                    };
                    hint: string;
                    required?: undefined;
                    options?: undefined;
                    typeOptions?: undefined;
                } | {
                    displayName: string;
                    name: string;
                    type: string;
                    default: number;
                    description: string;
                    placeholder: string;
                    displayOptions: {
                        show: {
                            parameterMode: string[];
                            type: string[];
                        };
                    };
                    required?: undefined;
                    options?: undefined;
                    typeOptions?: undefined;
                    hint?: undefined;
                } | {
                    displayName: string;
                    name: string;
                    type: string;
                    default: string;
                    description: string;
                    options: {
                        name: string;
                        value: string;
                        description: string;
                    }[];
                    displayOptions: {
                        show: {
                            parameterMode: string[];
                            type: string[];
                        };
                    };
                    placeholder?: undefined;
                    required?: undefined;
                    typeOptions?: undefined;
                    hint?: undefined;
                })[];
            }[];
            required?: undefined;
            placeholder?: undefined;
            hint?: undefined;
            minValue?: undefined;
            maxValue?: undefined;
        })[];
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
//# sourceMappingURL=ComfyUi.node.d.ts.map