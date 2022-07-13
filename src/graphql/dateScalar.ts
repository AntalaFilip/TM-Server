import { GraphQLScalarType, Kind } from "graphql";

const DateScalar = new GraphQLScalarType({
	name: `Date`,
	description: `Javascript Date scalar type`,
	serialize(value) {
		if (!(value instanceof Date)) return null;
		return value.getTime();
	},
	parseValue(value) {
		if (typeof value != "number") return null;
		return new Date(value);
	},
	parseLiteral(ast) {
		if (ast.kind === Kind.INT) {
			return new Date(parseInt(ast.value, 10));
		}
		return null;
	},
});

export default DateScalar;
