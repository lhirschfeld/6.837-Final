class Vector {
    constructor(data) {
        this.data = data;
        this.size = this.data.length;
    }

    getLength() {
        return Math.sqrt(this.data.reduce((total, num) => total + Math.pow(num, 2), 0));
    }

    map(f) {
        return new Vector(this.data.map(f));
    }

    scale(factor) {
        return this.map((value) => value * factor);
    }

    normalize() {
        let length = this.getLength();
        return this.scale(1/length)
    }

    static randomUnitVector(dimension) {
        let data = [];
        for (let _ = 0; _ < dimension; _++) {
            data.push(Math.random() - 0.5);
        }

        let vector = new Vector(data);

        // This check ensures that samples are drawn evenly from the unit circle.
        if (vector.getLength() > 1) {
            return Vector.randomUnitVector(dimension);
        } else {
            return vector.normalize();
        }

    }

    static dotProduct(a, b) {
        let sum = 0;
        for (let i = 0; i < a.size; i++) {
            sum += a.data[i] * b.data[i];
        }
        return sum;
    }

    static add(a, b) {
        let data = [];
        for (let i = 0; i < a.size; i++) {
            data.push(a.data[i] + b.data[i]);
        }
        return new Vector(data);
    }
}

class PerlinNoise {
    constructor(dimension, resolution) {
        this.dimension = dimension;
        this.resolution = resolution;
        this.grid = this.produceGrid(dimension);
        this.interpolation_fn = (start, end, t) => start + (end - start) * (6 * Math.pow(t, 5) - 15 * Math.pow(t, 4) + 10 * Math.pow(t, 3));
    }

    produceGrid(dimension) {
        if (dimension <= 0) return Vector.randomUnitVector(this.dimension);

        let sub_grid = [];
        for (let _ = 0; _ < this.resolution; _++) {
            sub_grid.push(this.produceGrid(dimension - 1));
        }
        return sub_grid;
    }

    produceDotProductCube(dimension) {
        if (dimension <= 0) return 0;

        let sub_cube = [];
        for (let _ = 0; _ < 2; _++) {
            sub_cube.push(this.produceDotProductCube(dimension-1));
        }

        return sub_cube;
    }

    interpolate(values, coordinates) {
        // Takes in an n dimensional hypercube and n dimensional coordinates (between 0 and 1).
        if (coordinates.size == 0) {
            return values
        } else if (coordinates.size == 1) {
            return this.interpolation_fn(values[0], values[1], coordinates.data[0]);
        } else {
            let new_coords = new Vector(coordinates.data.slice(1));
            let left = this.interpolate(values[0], new_coords);
            let right = this.interpolate(values[1], new_coords);
            return this.interpolation_fn(left, right, coordinates.data[0]);
        };

    }

    evaluate(position) {
        let scaled_position = new Vector(position).scale(this.resolution - 1);
        let dot_products = this.produceDotProductCube(this.dimension);

        // Compute Dot Products
        for (let i = 0; i < Math.pow(2, scaled_position.size); i++) {
            // Compute a "neighbor", a binary string which identifies one corner of the
            // dot_products hypercube.
            let neighbor = i.toString(2);
            while (neighbor.length < scaled_position.size) {
                neighbor = '0' + neighbor;
            }

            let neighbor_coords = [];

            let sub_grid = this.grid;
            for (let d = 0; d < scaled_position.size; d++) {
                let coord;
                if (neighbor.charAt(d) == '0') {
                    coord = Math.floor(scaled_position.data[d]);
                } else {
                    coord = Math.ceil(scaled_position.data[d]);
                }
                sub_grid = sub_grid[coord];
                neighbor_coords.push(coord);
            }

            let direction = Vector.add(scaled_position, (new Vector(neighbor_coords)).scale(-1));
            let dp = Vector.dotProduct(sub_grid, direction);

            let sub_dotproducts = dot_products;
            for (let j = 0; j < neighbor.length; j++) {
                let index = parseInt(neighbor.charAt(j));
                if (j < neighbor.length - 1) {
                    sub_dotproducts = sub_dotproducts[index];
                } else {
                    sub_dotproducts[index] = dp;
                }
            }
        }

        return this.interpolate(dot_products, scaled_position.map((c) => c - Math.floor(c)));
    }
}


const perlin_grid = (dimension, noise_resolution, pixel_resolution) => {
    let pn = new PerlinNoise(dimension, noise_resolution);
    screen = [];
    for (let i = 0; i < pixel_resolution[0]; i++) {
        let sub_screen = [];
        for (let j = 0; j < pixel_resolution[1]; j++) {
            sub_screen.push(pn.evaluate([i / pixel_resolution[0], j / pixel_resolution[1]]));
        }
        screen.push(sub_screen);
    }
    return screen;
}
