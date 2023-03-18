import { GraphQLError, GraphQLScalarType, Kind } from "graphql";

const DateScalar = new GraphQLScalarType({
	name: `Date`,
	description: `Javascript Date scalar type`,
	serialize(value) {
		if (!(value instanceof Date)) return null;
		return value.toJSON();
	},
	parseValue(value) {
		if (typeof value != "string") return null;
		return new Date(value);
	},
	parseLiteral(ast) {
		if (ast.kind === Kind.STRING) {
			const result = new Date(ast.value);
			if (result.toJSON() !== ast.value)
				throw new GraphQLError("Invalid date format!");
		}
		return null;
	},
});

export { DateScalar };
